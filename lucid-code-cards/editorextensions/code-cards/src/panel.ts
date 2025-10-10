import { CardBlockProxy, DocumentProxy, EditorClient, ItemProxy, Panel, PanelLocation, Viewport } from "lucid-extension-sdk";
import { assertNever } from "./util/never";
import { log } from "./logger";

type FromPanelMessage =
  | { type: 'selectionChanged'; selection: { id: string; cardData: CodeCardData } | null };

type FromFrameMessage =
  | { type: 'log'; message: string }
  | { type: 'promptPadLoaded' }
  | { type: 'setCardData'; cardId: string; cardData: CodeCardData }

export class CodeCardsPanel extends Panel {
  private autoOpen: boolean = true;
  private wasProgrammaticallyClosed: boolean = false;

  public constructor(client: EditorClient, private vp: Viewport, private doc: DocumentProxy) {
    super(client, {
      iconUrl: 'https://danmercer.net/favicon.svg',
      title: 'Code Cards',
      location: PanelLocation.RightDock,
      url: 'panel.html',
    });
    this.vp.hookSelection(() => {
      this.sendSelection();
    })
  }

  protected override messageFromFrame(message: FromFrameMessage): void {
    if (message.type === 'log') {
      console.log('Message from panel:', message.message);
    } else if (message.type === 'promptPadLoaded') {
      this.sendSelection();
    } else if (message.type === 'setCardData') {
      const item: ItemProxy|null = this.client.getBlockProxy(message.cardId);
      if (item && item instanceof CardBlockProxy) {
        const card: CardBlockProxy = item;
        card.shapeData.set('codeCardsData', JSON.stringify(message.cardData));
        log(`setCardData: Updated card ${message.cardId}`, message.cardData);
      } else {
        log(`setCardData: No card with ID ${message.cardId}`);
      }
    } else {
      assertNever(message);
    }
  }

  protected override frameLoaded(): void {
    // If the user opened the panel manually, start auto-opening it again
    if (!this.autoOpen) {
      log('Panel was opened again; enabling auto-open');
      this.autoOpen = true;
    }
    this.sendSelection();
  }

  protected override frameClosed(): void {
    if (!this.wasProgrammaticallyClosed) {
      // If the user closed the panel manually, stop auto-opening it until they open it manually
      log('Panel was manually closed; disabling auto-open');
      this.autoOpen = false;
    }
  }

  public override show() {
    this.wasProgrammaticallyClosed = false;
    super.show();
  }

  public override hide() {
    this.wasProgrammaticallyClosed = true;
    super.hide();
  }

  private sendSelection() {
    const selection = this.vp.getSelectedItems();
    if (selection.length == 1 && selection[0] instanceof CardBlockProxy) {
      if (this.autoOpen) {
        this.show();
      }
      const block: CardBlockProxy = selection[0];
      this.selectionChanged(block);
    } else {
      this.hide(); // TODO show a "select a card" message in the panel instead
      this.selectionChanged(null);
    }
  }

  private messageToFrame(message: FromPanelMessage) {
    // 'as any' because the SDK types are bad
    this.sendMessage(message as any);
  }

  private selectionChanged(card: CardBlockProxy|null) {
    if (this.loaded) {
      this.messageToFrame({
        type: 'selectionChanged',
        selection: card ? {
          id: card.id,
          cardData: readPrompt(card),
        } : null,
      });
    }
  }
}

interface CodeCardData {
  prompt: string;
}

const defaultData: CodeCardData = {
  prompt: '',
};

function readPrompt(card: CardBlockProxy): CodeCardData {
  const raw = card.shapeData.get('codeCardsData');
  if (!raw) {
    return defaultData;
  }
  try {
    const parsed = JSON.parse(raw as string);
    return parsed;
  } catch (err) {
    console.error('Error parsing codeCardsData:', err);
    return defaultData;
  }
}
