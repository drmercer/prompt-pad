import {EditorClient, Menu, MenuType, Viewport} from 'lucid-extension-sdk';
import {log} from './logger';

const client = new EditorClient();
const menu = new Menu(client);
const viewport = new Viewport(client);

viewport.hookSelection((selection) => {
  log('Selection changed', selection);
})

menu.addMenuItem({
    label: 'Show import modal',
    action: 'show-import-modal',
    menuType: MenuType.Main,
});
