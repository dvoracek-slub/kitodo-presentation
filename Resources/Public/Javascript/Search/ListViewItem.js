import { html, LitElement } from './lit-all.min.js';

export class ListViewItem extends LitElement {
    constructor() {
        super();

        this.translations = {};
        this.listedMetadata = [];
        this.structures = [];
        this.searchResults = null;
        this.doc = null;
        this.showParts = false;
    }

    static get properties() {
        return {
            translations: {},
            listedMetadata: {},
            structures: {},
            searchResults: { type: Object },
            doc: { type: Object },
            showParts: {
                state: true,
                type: Boolean,
                reflect: true,
            },
        };
    }

    createRenderRoot() {
        return this;
    }

    renderListedMetadata(doc) {
        if (doc.metadata) {
            return html`
                ${this.listedMetadata.map((metadata) => {
                    if (
                        !doc.metadata[metadata.indexName]?.[0]
                        || metadata.indexName === 'type'
                        || metadata.indexName === 'title'
                    ) {
                        return;
                    }

                    return html`
                        <dt class="tx-dlf-metadata-${metadata.indexName}">${metadata.label}</dt>
                        ${doc.metadata[metadata.indexName].map((metadataentry) => html`
                            <dd class="tx-dlf-metadata-${metadata.indexName}">${metadataentry}</dd>
                        `)}
                    `;
                })}
            `;
        } else {
            return html`
                <p class="error">No metadata for document with uid=${doc.uid}</p>
            `;
        }
    }

    renderMetadata(doc, docTitle) {
        return html`
            <dl>
                <dt class="tx-dlf-title">${this.translations['metadata.title']}</dt>
                <dd class="tx-dlf-title">${docTitle}</dd>

                ${this.renderListedMetadata(doc)}

                <dt class="tx-dlf-type">${this.translations['structure']}</dt>
                <dd class="tx-dlf-type">${this.structures.find(struc => struc.indexName === doc.structure)?.label ?? doc.structure}</dd>
            </dl>
        `;
    }

    renderThumbnail(thumbnail, docTitle) {
        // slub_digitalcollections uses the :empty CSS selector to check for missing thumbnail, so avoid superfluous spaces
        return html`<div class="tx-dlf-listview-thumbnail">${thumbnail ? html`<img src="${thumbnail}" loading="lazy" alt="Vorschaubild von ${docTitle}" />` : ''}</div>`;
    }

    renderChildren(doc) {
        if (!doc.children?.length) {
            return;
        }

        return html`
            <ol class="tx-dlf-volume">
                ${doc.children.map((child, index) => {
                    if (doc.structure === 'ephemera' || doc.structure === 'newspaper') {
                        // Special output for Newspaper / Ephemera
                        return html`
                            <li value="${index % 2}" class="years">
                                <a href="${child.pageLink}" title="${child.metsOrderlabel || `[${doc.title}]`}">
                                    ${child.metsOrderlabel}
                                </a>
                            </li>
                        `;
                    } else {
                        const childTitle = child.title || `[${doc.title}]`;

                        return html`
                            <li value="${index % 2}" class="pageresult">
                                <a href="${child.pageLink}" title="${child.metsOrderlabel || `[${doc.title}]`}">
                                    ${this.renderThumbnail(child.thumbnail, childTitle)}
                                    ${this.renderMetadata(child, childTitle)}
                                </a>
                            </li>
                        `;
                    }
                })}
            </ol>
        `;
    }

    renderSearchResults(doc) {
        if (!doc.searchResults?.length) {
            return;
        }

        return html`
            <ol class="tx-dlf-volume">
                ${doc.searchResults.map((result, index) => {
                    const resultTitle = result.title || `[${doc.title}]`;

                    return html`
                        <li value="${index % 2}" class="pageresult">
                            <a href="${result.pageLink}" title="${result.metsOrderlabel || `[${doc.title}]`}">
                                ${this.renderThumbnail(result.thumbnail, resultTitle)}
                                ${this.renderMetadata(result, resultTitle)}
                            </a>
                        </li>
                    `;
                })}
            </ol>
        `;
    }

    toggleParts() {
        this.showParts = !this.showParts;
        $(this).find('.tx-dlf-volume').slideToggle();
    }

    render() {
        if (this.doc === null || this.searchResults === null) {
            return;
        }

        const docTitle = this.doc.title || this.doc.metsOrderlabel;
        const className = this.showParts ? 'tx-dlf-volumes-open' : '';

        return html`
            <li class="${className}">
                <a href="${this.doc.pageLink}">
                    ${this.renderThumbnail(this.doc.thumbnail, docTitle)}
                    ${this.renderMetadata(this.doc, docTitle)}
                </a>

                ${(this.doc.children?.length || this.doc.searchResults?.length) ? html`
                    <button
                        class="tx-dlf-morevolumes"
                        title="${this.translations['listview.moredetails.toggle']}"
                        @click="${this.toggleParts}"
                    >
                        ${this.translations['listview.moredetails.toggle']}
                    </button>
                ` : ''}

                ${this.showParts || true ? html`
                    ${this.renderChildren(this.doc)}
                    ${this.renderSearchResults(this.doc)}
                ` : ''}
            </li>
        `;
    }
}

customElements.define('dlf-listview-item', ListViewItem);
