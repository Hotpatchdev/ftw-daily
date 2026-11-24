(function () {
  function configureChat() {
    window.tidioChatApi.setColorPalette('#ac2858');
    var button = document.getElementById('open-chat');
    button.hidden = false;
    button.onclick = function () {
      window.tidioChatApi.open();
    };
  }

  if (window.tidioChatApi) {
    window.tidioChatApi.on('ready', configureChat);
  } else {
    document.addEventListener('tidioChat-ready', configureChat);
  }
})();
