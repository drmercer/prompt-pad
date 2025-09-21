import {EditorClient, Menu, MenuType, Viewport} from 'lucid-extension-sdk';
import {ImportModal} from './importmodal';

const client = new EditorClient();
const menu = new Menu(client);
const viewport = new Viewport(client);

client.registerAction('show-import-modal', () => {
    const modal = new ImportModal(client);
    modal.show();
});

menu.addMenuItem({
    label: 'Show import modal',
    action: 'show-import-modal',
    menuType: MenuType.Main,
});
