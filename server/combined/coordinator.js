const crypto = require('crypto');

const PARENT = 'hotpatch-combined-booking';
const CHILD = 'hotpatch-combined-reservation';
const uuid = value => typeof value === 'string' ? value : value && value.uuid;
const attr = tx => tx.attributes || {};
const state = tx => attr(tx).state;
const relation = (tx, name) => uuid(tx.relationships && tx.relationships[name] && tx.relationships[name].data.id);
const stopped = tx => ['state/payment-expired', 'state/declined', 'state/cancelled'].includes(state(tx));
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const bookingOf = (response, tx) => (response.included || []).find(x => x.type === 'booking' && uuid(x.id) === relation(tx, 'booking'));

class CombinedCoordinator {
  constructor({ store, integration, now = () => new Date() }) {
    this.store = store;
    this.api = integration;
    this.now = now;
  }
  async findIssued(record, processName, index) {
    // A request may have succeeded remotely before its response was lost. Never
    // issue that creation again. Search every page, including orphan children.
    let page = 1;
    do {
      const result = await this.api.query({ processNames: [processName], customerId: record.customer,
        listingId: record.listing, createdAtStart: new Date(record.createdAt - 60000), page, perPage: 100 });
      const found = result.data.filter(tx => {
        const data = attr(tx).protectedData || {};
        return data.combinedAttempt === record.key && (index == null || data.sessionIndex === index);
      });
      if (found.length > 1) throw new Error('Duplicate session reservation requires review.');
      if (found.length) return uuid(found[0].id);
      if (page >= result.meta.totalPages) return null;
      page += 1;
    } while (true);
  }
  async recover(record) {
    if (record.parentIssuing && !record.parent) {
      record.parent = await this.findIssued(record, PARENT);
      if (!record.parent) throw new Error('Checkout is being recovered. Please retry shortly.');
      record.parentIssuing = false;
      this.store.save(record);
    }
    for (let i = 0; i < record.children.length; i++) {
      const child = record.children[i];
      if (child.issuing && !child.id) {
        child.id = await this.findIssued(record, CHILD, i);
        if (!child.id) {
          if (record.intent === 'abort') continue;
          throw new Error('A session reservation is being recovered. Please retry shortly.');
        }
        child.issuing = false;
        this.store.save(record);
      }
    }
  }
  async start({ customer, attempt, listing, plan, trusted, payment = {} }) {
    const key = this.store.key(customer, attempt);
    return this.store.lock(key, async () => {
      const fingerprint = hash({ listing, schedule: plan.schedule, total: plan.customerTotal, payout: plan.providerTotal });
      let record = this.store.read(key);
      if (record && record.fingerprint !== fingerprint) throw new Error('Checkout selection changed. Return to the space and review it again.');
      if (!record) {
        record = { key, customer, listing, fingerprint, createdAt: this.now().getTime(),
          parent: null, parentIssuing: false, schedule: plan.schedule,
          sessions: plan.sessions.map(s => ({ start: s.start.toISOString(), end: s.end.toISOString() })),
          children: plan.childSessions.map(() => ({ id: null, issuing: false })), ready: false, intent: null };
        this.store.save(record);
      }
      await this.recover(record);
      if (record.done && !record.parent) throw new Error('This checkout could not reserve your selection. Return to the space and try again.');
      if (!record.parent) {
        record.parentIssuing = true;
        this.store.save(record);
        try {
          const response = await trusted.initiate({ processAlias: `${PARENT}/release-1`, transition: 'transition/request-payment',
            params: { listingId: listing, bookingStart: plan.anchor.start, bookingEnd: plan.anchor.end,
              bookingDisplayStart: plan.displayStart, bookingDisplayEnd: plan.displayEnd, seats: plan.seats || 1,
              lineItems: plan.lineItems, ...payment,
              protectedData: { combinedBooking: true, combinedAttempt: key, schedule: plan.schedule,
                sessions: record.sessions, type: plan.type, isHourly: plan.type === 'price', isDaily: plan.type === 'pricePerDay',
                sessionLabels: plan.sessions.map(s => ({ label: s.label || `${s.start.toISOString()} – ${s.end.toISOString()}` })) } } });
          record.parent = uuid(response.data.id);
          record.parentIssuing = false;
          this.store.save(record);
        } catch (e) {
          if (e.status >= 400 && e.status < 500 && e.status !== 408) {
            record.parentIssuing = false;
            record.done = true;
            this.store.save(record);
          }
          // Even a timeout is ambiguous; retain the journal before returning.
          throw e;
        }
      }
      const parent = (await this.api.show(record.parent)).data;
      if (stopped(parent)) throw new Error('This checkout has expired. Return to the space to start again.');
      if (record.ready) return record.parent;
      try {
        for (let i = 0; i < record.children.length; i++) {
          const child = record.children[i];
          if (child.id) continue;
          child.issuing = true;
          this.store.save(record);
          const session = plan.childSessions[i];
          let response;
          try { response = await trusted.initiate({ processAlias: `${CHILD}/release-1`, transition: 'transition/reserve-session',
            params: { listingId: listing, bookingStart: session.start, bookingEnd: session.end,
              bookingDisplayStart: plan.displayStart, bookingDisplayEnd: plan.displayEnd, seats: plan.seats || 1,
              protectedData: { combinedAttempt: key, combinedParentId: record.parent, sessionIndex: i } } }); }
          catch (e) {
            if (e.status >= 400 && e.status < 500 && e.status !== 408) child.issuing = false;
            this.store.save(record);
            throw e;
          }
          child.id = uuid(response.data.id);
          child.issuing = false;
          this.store.save(record);
        }
        await this.checkChildren(record, ['state/pending']);
        record.ready = true;
        this.store.save(record);
        return record.parent;
      } catch (e) {
        record.intent = 'abort';
        this.store.save(record);
        // Try cleanup now; the worker retries if the API is unavailable.
        try { await this.reconcile(record); } catch (_) { /* durable retry */ }
        throw e;
      }
    });
  }
  async checkChildren(record, allowed) {
    if (record.children.some(c => !c.id)) throw new Error('The session reservations are incomplete.');
    for (let i = 0; i < record.children.length; i++) {
      const response = await this.api.show(record.children[i].id);
      const tx = response.data, data = attr(tx).protectedData || {};
      const booking = bookingOf(response, tx);
      if (attr(tx).processName !== CHILD || data.combinedParentId !== record.parent ||
          data.combinedAttempt !== record.key || data.sessionIndex !== i ||
          relation(tx, 'customer') !== record.customer || relation(tx, 'listing') !== record.listing ||
          !booking || new Date(booking.attributes.start).toISOString() !== record.sessions[i].start ||
          new Date(booking.attributes.end).toISOString() !== record.sessions[i].end || !allowed.includes(state(tx)))
        throw Object.assign(new Error('A selected session could not be reserved. Please review your dates again.'), { code: 'RESERVATION_LOST' });
    }
  }
  recordFor(parentId) {
    const record = this.store.records().find(r => r.parent === parentId);
    if (!record) throw new Error('The combined booking could not be found.');
    return record;
  }
  async act(parentId, actor, action) {
    const first = this.recordFor(parentId);
    return this.store.lock(first.key, async () => {
      const record = this.store.read(first.key);
      const parent = (await this.api.show(parentId)).data;
      if (attr(parent).processName !== PARENT ||
          (action === 'confirm' ? relation(parent, 'customer') : relation(parent, 'provider')) !== actor)
        throw Object.assign(new Error('This booking action is not available.'), { status: 403 });
      if (!['confirm', 'accept', 'decline'].includes(action)) throw new Error('Invalid booking action.');
      const current = state(parent);
      const already = action === 'confirm' ? ['state/preauthorized', 'state/accepted'].includes(current)
        : action === 'accept' ? current === 'state/accepted' : current === 'state/declined';
      if (already) { await this.reconcile(record); return parentId; }
      if ((action === 'confirm' && current !== 'state/pending-payment') ||
          (action !== 'confirm' && current !== 'state/preauthorized')) throw new Error('The booking has already changed. Refresh to see its status.');
      if (action !== 'decline' && !record.ready) throw new Error('The session reservations are incomplete.');
      // Persist the human's authorized decision before changing any reservation.
      record.intent = action;
      this.store.save(record);
      await this.reconcile(record);
      return parentId;
    });
  }
  async childTransition(record, from, transition) {
    for (const child of record.children) {
      if (!child.id) continue;
      const tx = (await this.api.show(child.id)).data;
      if (from.includes(state(tx))) await this.api.transition(child.id, transition);
    }
  }
  async releaseChildren(record) {
    for (const child of record.children) {
      if (!child.id) continue;
      const tx = (await this.api.show(child.id)).data;
      const transition = { 'state/pending': 'transition/release-pending-session',
        'state/held': 'transition/release-held-session', 'state/accepted': 'transition/cancel-session' }[state(tx)];
      if (transition) await this.api.transition(child.id, transition);
    }
  }
  async reconcile(record) {
    await this.recover(record);
    if (!record.parent) return;
    let parent = (await this.api.show(record.parent)).data;
    if (stopped(parent)) {
      await this.releaseChildren(record);
      record.done = !record.children.some(c => c.issuing);
      this.store.save(record);
      return;
    }
    if (!record.ready && !record.intent) {
      record.intent = 'abort';
      this.store.save(record);
    }
    if (record.intent === 'abort' && state(parent) === 'state/pending-payment') {
      await this.api.transition(record.parent, 'transition/abort-payment');
      await this.releaseChildren(record);
      record.done = !record.children.some(c => c.issuing); this.store.save(record); return;
    }
    if (record.ready && ['state/preauthorized', 'state/accepted'].includes(state(parent))) {
      try { await this.checkChildren(record, state(parent) === 'state/accepted'
        ? ['state/accepted'] : ['state/held', 'state/accepted']); }
      catch (e) {
        if (e.code !== 'RESERVATION_LOST') throw e;
        await this.api.transition(record.parent, state(parent) === 'state/accepted'
          ? 'transition/cancel' : 'transition/operator-decline');
        await this.releaseChildren(record);
        record.done = true; this.store.save(record); return;
      }
    }
    // Stripe's confirm action succeeds only after Stripe.js has authorized the
    // card. Trying it here also recovers a browser closed after authorization.
    if (record.ready && !record.intent && state(parent) === 'state/pending-payment') {
      record.intent = 'confirm'; this.store.save(record);
    }
    if (record.intent === 'confirm' && state(parent) === 'state/pending-payment') {
      await this.checkChildren(record, ['state/pending', 'state/held']);
      await this.childTransition(record, ['state/pending'], 'transition/hold-session');
      await this.api.transition(record.parent, 'transition/operator-confirm-payment');
      parent = (await this.api.show(record.parent)).data;
    }
    if (record.intent === 'decline' && state(parent) === 'state/preauthorized') {
      await this.api.transition(record.parent, 'transition/operator-decline');
      await this.releaseChildren(record);
      record.done = true; this.store.save(record); return;
    }
    if (record.intent === 'accept' && state(parent) === 'state/preauthorized') {
      if (new Date(record.sessions[0].start) <= this.now()) {
        await this.api.transition(record.parent, 'transition/operator-decline');
        await this.releaseChildren(record);
        record.done = true; this.store.save(record); return;
      }
      await this.checkChildren(record, ['state/held', 'state/accepted']);
      await this.childTransition(record, ['state/held'], 'transition/accept-session');
      await this.api.transition(record.parent, 'transition/operator-accept');
      parent = (await this.api.show(record.parent)).data;
    }
    if (['state/accepted', 'state/delivered', 'state/reviewed', 'state/reviewed-by-provider', 'state/reviewed-by-customer'].includes(state(parent))) {
      await this.checkChildren(record, ['state/accepted']);
      if (new Date(record.sessions[record.sessions.length - 1].end) < this.now()) {
        record.done = true; this.store.save(record);
      }
    }
  }
  async sweep() {
    for (const candidate of this.store.records().filter(r => !r.done)) {
      await this.store.lock(candidate.key, async () => {
        try { await this.reconcile(this.store.read(candidate.key)); }
        catch (e) { console.error('Combined booking recovery needs retry', candidate.key, e.status || 'unavailable'); }
      });
    }
  }
}
module.exports = { CombinedCoordinator, PARENT, CHILD, uuid };
