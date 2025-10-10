import {DocumentProxy, EditorClient, Menu, Viewport} from 'lucid-extension-sdk';
import {log} from './logger';
import { CodeCardsPanel } from './panel';

const client = new EditorClient();
const viewport = new Viewport(client);
const document = new DocumentProxy(client);

client.registerAction('open-code-cards', () => {
  log('Action: Open Code Cards');
  panel.show();
});

const menu = new Menu(client);
menu.addContextMenuItem({
  label: 'Open Code Cards',
  action: 'open-code-cards',
});

const panel = new CodeCardsPanel(client, viewport, document);

log('Extension initialized!');
