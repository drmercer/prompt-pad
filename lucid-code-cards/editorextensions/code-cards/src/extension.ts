import {BlockProxy, EditorClient, Menu, Panel, PanelLocation, Viewport} from 'lucid-extension-sdk';
import {log} from './logger';

const client = new EditorClient();
const viewport = new Viewport(client);

class MyPanel extends Panel {
  constructor(client: EditorClient) {
    super(client, {
      iconUrl: 'https://danmercer.net/favicon.svg',
      title: 'Code Cards',
      location: PanelLocation.RightDock,
      url: 'https://danmercer.net',
    });
  }
}

client.registerAction('open-code-cards', () => {
  log('Action: Open Code Cards');
  panel.show();
});

const menu = new Menu(client);
menu.addContextMenuItem({
  label: 'Open Code Cards',
  action: 'open-code-cards',
});

const panel = new MyPanel(client);

viewport.hookSelection((selection) => {
  if (selection.length == 1 && selection[0] instanceof BlockProxy) {
    const block = selection[0] as BlockProxy;
    log('Selected block ID:', block.id, block.getClassName());
    panel.show();
  } else {
    panel.hide();
  }
})
