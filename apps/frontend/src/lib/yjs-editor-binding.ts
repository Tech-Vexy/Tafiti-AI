/**
 * YjsEditorBinding — bidirectional binding between Yjs XmlFragment and
 * Syncfusion Document Editor.
 */

import * as Y from 'yjs';

export class YjsEditorBinding {
  doc: Y.Doc;
  yXmlFragment: Y.XmlFragment;
  provider: any;
  editorRef: any;
  private _localUpdate: boolean = false;
  private _syncDebounce: any = null;
  private _lastHash: string = '';
  private _destroyed: boolean = false;
  private _observer: (events: any[], transaction: any) => void;
  private _contentPoll: any = null;

  constructor(doc: Y.Doc, yXmlFragment: Y.XmlFragment, provider: any, editorRef: any) {
    this.doc = doc;
    this.yXmlFragment = yXmlFragment;
    this.provider = provider;
    this.editorRef = editorRef;

    // Observe remote changes to Yjs document
    this._observer = (events, transaction) => {
      if (this._localUpdate || transaction.local) return;
      this._handleRemoteChange();
    };
    this.yXmlFragment.observeDeep(this._observer);

    // Listen for local editor changes
    this._setupLocalListener();
  }

  private _setupLocalListener() {
    this._pollForEditor();
  }

  private _pollForEditor() {
    if (this._destroyed) return;

    const check = () => {
      if (this._destroyed) return;

      const editor = this.editorRef?.current;
      if (editor && typeof editor.serialize === 'function') {
        this._setupContentChangeListener(editor);
        return;
      }

      setTimeout(check, 500);
    };

    check();
  }

  private _setupContentChangeListener(editor: any) {
    this._contentPoll = setInterval(() => {
      if (this._destroyed || this._localUpdate) return;

      try {
        const content = editor.serialize();
        const hash = this._hashContent(content);

        if (hash !== this._lastHash && this._lastHash !== '') {
          this._lastHash = hash;
          this._pushToYjs(content);
        } else if (this._lastHash === '') {
          this._lastHash = hash;
        }
      } catch (e) {
        // Editor may not be ready
      }
    }, 1000);
  }

  private _pushToYjs(content: string) {
    if (this._destroyed) return;

    this._localUpdate = true;

    try {
      this.doc.transact(() => {
        const yText = this.doc.getText('thesis-content-text');
        const currentContent = yText.toString();

        if (currentContent !== content) {
          yText.delete(0, currentContent.length);
          yText.insert(0, content);
        }

        while (this.yXmlFragment.length > 0) {
          this.yXmlFragment.delete(0);
        }
        const paragraph = new Y.XmlElement('paragraph');
        paragraph.setAttribute('style', 'Normal');
        const textNode = new Y.XmlText();
        textNode.insert(0, content);
        paragraph.push([textNode]);
        this.yXmlFragment.push([paragraph]);
      });

      const update = Y.encodeStateAsUpdate(this.doc);
      if (this.provider) {
        this.provider.sendUpdate(update);
      }
    } catch (e) {
      console.warn('[YjsBinding] Failed to push to Yjs:', e);
    } finally {
      setTimeout(() => {
        this._localUpdate = false;
      }, 50);
    }
  }

  private _handleRemoteChange() {
    if (this._destroyed || this._localUpdate) return;

    try {
      const yText = this.doc.getText('thesis-content-text');
      const remoteContent = yText.toString();

      const editor = this.editorRef?.current;
      if (!editor) return;

      const localContent = editor.serialize();
      const remoteHash = this._hashContent(remoteContent);
      const localHash = this._hashContent(localContent);

      if (remoteHash !== localHash) {
        this._localUpdate = true;

        try {
          if (typeof editor.open === 'function') {
            editor.open(remoteContent);
          } else if (typeof editor.loadDocument === 'function') {
            editor.loadDocument(remoteContent);
          }

          this._lastHash = remoteHash;

          if (this.provider) {
            this.provider.persistState &&
              setTimeout(() => this.provider.persistState(), 1000);
          }
        } finally {
          setTimeout(() => {
            this._localUpdate = false;
          }, 50);
        }
      }
    } catch (e) {
      console.warn('[YjsBinding] Failed to handle remote change:', e);
      this._localUpdate = false;
    }
  }

  loadInitialContent() {
    if (this._destroyed) return;

    try {
      const yText = this.doc.getText('thesis-content-text');
      const content = yText.toString();

      if (!content || content === '{}') return;

      const editor = this.editorRef?.current;
      if (!editor) return;

      this._localUpdate = true;
      try {
        if (typeof editor.open === 'function') {
          editor.open(content);
        } else if (typeof editor.loadDocument === 'function') {
          editor.loadDocument(content);
        }
        this._lastHash = this._hashContent(content);
      } finally {
        setTimeout(() => {
          this._localUpdate = false;
        }, 50);
      }
    } catch (e) {
      console.warn('[YjsBinding] Failed to load initial content:', e);
      this._localUpdate = false;
    }
  }

  replaceContent(content: string) {
    if (this._destroyed) return;

    const editor = this.editorRef?.current;
    if (!editor) return;

    this._localUpdate = true;
    try {
      if (typeof editor.open === 'function') {
        editor.open(content);
      } else if (typeof editor.loadDocument === 'function') {
        editor.loadDocument(content);
      }
      this._lastHash = this._hashContent(content);
      this._pushToYjs(content);
    } catch (e) {
      console.warn('[YjsBinding] Failed to replace content:', e);
    } finally {
      setTimeout(() => {
        this._localUpdate = false;
      }, 50);
    }
  }

  insertText(text: string) {
    if (this._destroyed) return;

    const editor = this.editorRef?.current;
    if (!editor) return;

    try {
      if (typeof editor.replaceSelection === 'function') {
        editor.replaceSelection(text);
      }

      setTimeout(() => {
        try {
          const content = editor.serialize();
          this._pushToYjs(content);
        } catch (e) {
          // Ignore
        }
      }, 100);
    } catch (e) {
      console.warn('[YjsBinding] Failed to insert text:', e);
    }
  }

  private _hashContent(content: any): string {
    if (!content) return '';
    let hash = 0x811c9dc5;
    const str = typeof content === 'string' ? content : JSON.stringify(content);
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash.toString(36);
  }

  destroy() {
    this._destroyed = true;

    if (this._contentPoll) {
      clearInterval(this._contentPoll);
      this._contentPoll = null;
    }

    if (this._syncDebounce) {
      clearTimeout(this._syncDebounce);
    }

    this.yXmlFragment.unobserveDeep(this._observer);
  }
}
