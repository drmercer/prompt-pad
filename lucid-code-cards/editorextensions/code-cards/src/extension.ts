import {EditorClient, Menu, MenuType, Panel, PanelLocation, Viewport} from 'lucid-extension-sdk';
import {log} from './logger';

const client = new EditorClient();
const menu = new Menu(client);
const viewport = new Viewport(client);

class MyPanel extends Panel {
  constructor(client: EditorClient) {
    super(client, {
      iconUrl: 'http://danmercer.net/favicon.svg',
      title: 'Code Cards',
      location: PanelLocation.RightDock,
      url: 'https://danmercer.net',
    });
  }
}

new MyPanel(client);

viewport.hookSelection((selection) => {
  log('Selection changed', selection);
})

menu.addMenuItem({
    label: 'Show import modal',
    action: 'show-import-modal',
    menuType: MenuType.Main,
});
