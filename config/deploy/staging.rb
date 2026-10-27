set :stage, :staging
set :branch, ENV['BRANCH'] || "staging"
set :deploy_to, "/home/sharetribe/web/staging.hotpatch.com"

namespace :deploy do
  after "symlink:release", :app_restart
  desc 'restart application'
  task :app_restart do
    on roles(:app), in: :sequence, wait: 5 do
      # Save the current release in the same session as the restart.
      execute "pm2 delete staging || true"
      execute "NODE_ENV=production pm2 start /home/sharetribe/web/staging.hotpatch.com/current/server/index.js --cwd /home/sharetribe/web/staging.hotpatch.com/current --interpreter /home/sharetribe/.nvm/versions/node/v14.15.4/bin/node --name staging && pm2 save"
    end
  end
end

server 'staging.hotpatch.com', port: 9922, user: 'sharetribe', roles: %w{app web db}
