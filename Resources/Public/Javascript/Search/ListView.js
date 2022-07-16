import { html, LitElement, createRef, ref } from './lit-all.min.js';
import { loadingBlur } from './lib.js';

import './ListViewItem.js';

const LoadState = {
    Idle: 0,
    NewPage: 1,
    NewTerm: 2,
};

function sprintf(input, values) {
    let i = 0;
    return (input ?? "???").replace(/%[sd]/g, () => values[i++]);
}

class ListView extends LitElement {
    constructor() {
        super();

        this.apiSettings = "";
        this.translations = {};
        this.sortableMetadata = [];
        this.listedMetadata = [];
        this.structures = [];
        this.searchResults = null;
        this.orderSelectRef = createRef();
        this.orderBySelectRef = createRef();
        this.fulltextRadioRef = createRef();
        this.queryInputRef = createRef();
        this.searchResultsPromise = {};
        this.loadState = LoadState.Idle;
        this.values = {
            query: '',
            fulltext: false,
            page: 0,
            numPages: 0,
            orderBy: 'serial_sorting',
            order: 'asc',
        };

        this.readFromUrl();

        window.addEventListener('popstate', (e) => {
            if (e.state === null) {
                return;
            }

            if (e.state.type === 'dlf-listview-state') {
                this.values = e.state.values;
                this.search(false);
            }
        });
    }

    readFromUrl() {
        const params = new URL(window.location.href).searchParams;
        Object.assign(this.values, {
            query: params.get('tx_dlf_listview[searchParameter][query]') ?? '',
            fulltext: params.get('tx_dlf_listview[searchParameter][fulltext]') == '1',
            page: parseInt(params.get('tx_dlf_listview[@widget_0][currentPage]') ?? '1', 10) - 1,
            orderBy: params.get('tx_dlf_listview[searchParameter][orderBy]') || 'serial_sorting',
            order: params.get('tx_dlf_listview[searchParameter][order]') || 'asc',
        });
    }

    pushHistoryState() {
        window.history.pushState({
            type: 'dlf-listview-state',
            values: this.values,
        }, '', this.valuesToUrl(this.values));
    }

    valuesToUrl(values) {
        const url = new URL(window.location.href);
        url.searchParams.set('tx_dlf_listview[searchParameter][query]', values.query);
        url.searchParams.set('tx_dlf_listview[searchParameter][fulltext]', values.fulltext ? '1' : '0');
        url.searchParams.set('tx_dlf_listview[@widget_0][currentPage]', `${values.page + 1}`);
        url.searchParams.set('tx_dlf_listview[searchParameter][orderBy]', values.orderBy) ;
        url.searchParams.set('tx_dlf_listview[searchParameter][order]', values.order);
        return url.toString();
    }

    static get properties() {
        return {
            apiSettings: { type: String },
            translations: { type: Object },
            sortableMetadata: { type: Array },
            listedMetadata: { type: Array },
            structures: { type: Array },
            searchResults: {},
            loadState: {},
        };
    }

    createRenderRoot() {
        return this;
    }

    connectedCallback() {
        super.connectedCallback();

        this.loadState = LoadState.NewTerm;
        this.search();
    }

    async doSearch() {
        const response = await fetch(`/?eID=tx_dlf_search&settings=${encodeURIComponent(this.apiSettings)}&page=${this.values.page}&term=${encodeURIComponent(this.values.query)}&order=${this.values.order}&orderBy=${encodeURIComponent(this.values.orderBy)}&fulltext=${this.values.fulltext ? 1 : 0}`);
        const obj = await response.json();
        obj.documents = Object.values(obj.documents);
        for (const doc of obj.documents) {
            if (doc.children) {
                doc.children = Object.values(doc.children);
            }
        }
        return obj;
    }

    async search(pushState = true) {
        const key = `${this.apiSettings}:${this.values.query}:${this.values.page}:${this.values.order}:${this.values.orderBy}:${this.values.fulltext ? 'fulltext' : 'metadata'}`;
        let promise = this.searchResultsPromise[key];
        if (promise === undefined) {
            promise = this.searchResultsPromise[key] = this.doSearch();
        }
        try {
            const queryInput = this.queryInputRef.value;
            if (queryInput) {
                const top = queryInput.getBoundingClientRect().top;
                if (top < 0) {
                    const pageY = top - document.body.getBoundingClientRect().top;
                    $('html, body').animate({ scrollTop: pageY - 100 }, 250);
                }
            }

            this.searchResults = await promise;
            this.values.numPages = Math.ceil(this.searchResults.numberOfToplevels / this.searchResults.params.pageSize);
        } catch (e) {
            console.error(e);
        } finally {
            this.loadState = LoadState.Idle;
        }

        if (pushState) {
            this.pushHistoryState();
        }
    }

    submitSearch(e) {
        e.preventDefault();

        this.values.query = this.queryInputRef.value.value;
        this.values.page = 0;

        this.loadState = LoadState.NewTerm;
        this.search();
    }

    showPage(page) {
        this.loadState = LoadState.NewPage;
        this.values.page = page;
        this.search();
    }

    changeOrderBy() {
        this.values.orderBy = this.orderBySelectRef.value.value;
        this.values.page = 0;

        this.loadState = LoadState.NewPage;
        this.search();
    }

    changeOrder() {
        this.values.order = this.orderSelectRef.value.value;
        this.values.page = 0;

        this.loadState = LoadState.NewPage;
        this.search();
    }

    changeFulltext() {
        this.values.fulltext = this.fulltextRadioRef.value.checked;
    }

    makePageButton(page, which = '') {
        if (page === null) {
            return html`<li>…</li>`;
        } else if (page === this.values.page) {
            return html`
                <li class="current">
                    ${page + 1}
                </li>
            `;
        } else {
            let style = '';

            // Hide previous/next buttons on first/last page
            // (not "display: none;" to keep button layout fixed)
            if (!(0 <= page && page < this.values.numPages)) {
                if (which === '') {
                    return '';
                } else {
                    style += 'visibility: hidden;';
                }
            }

            return html`
                <li class="${which}" style="${style}">
                    <a href="${this.valuesToUrl({ ...this.values, page })}" @click="${(e) => { e.preventDefault(); this.showPage(page); }}">
                        ${page + 1}
                    </a>
                </li>
            `;
        }
    }

    renderPager() {
        const pageButtons = [];
        let count = 10;
        let start = Math.max(0, this.values.page - 4);
        let end = Math.min(this.values.numPages, start + count);
        if (end - start < count) {
            start = Math.max(0, end - count);
        }
        if (start >= 2) {
            start++;
        }
        if (this.values.numPages <= end) {
            start--;
        }
        pageButtons.push(this.makePageButton(this.values.page - 1, 'previous'));
        if (start > 0) {
            pageButtons.push(this.makePageButton(0));
            if (start > 1) {
                if (start > 2) {
                    pageButtons.push(this.makePageButton(null));
                } else {
                    pageButtons.push(this.makePageButton(1));
                }
            }
            end--;
        }
        for (let i = start; i < end; i++) {
            pageButtons.push(this.makePageButton(i));
        }
        if (this.values.numPages > end) {
            if (this.values.numPages > end + 1) {
                if (this.values.numPages > end + 2) {
                    pageButtons.push(this.makePageButton(null));
                } else {
                    pageButtons.push(this.makePageButton(this.values.numPages - 2));
                }
            }
            pageButtons.push(this.makePageButton(this.values.numPages - 1));
        }
        pageButtons.push(this.makePageButton(this.values.page + 1, 'next'));

        return html`
            <ul class="f3-widget-paginator">
                ${pageButtons}
            </ul>
        `
    }

    render() {
        if (this.searchResults === null) {
            return html`
                Loading...
            `;
        }

        return html`
            <form @submit="${this.submitSearch}" method="post" class="tx-dlf-search-form">
                <div>
                    <!-- Never change the @id of this input field! Otherwise search suggestions won't work! -->
                    <label for="tx-dlf-search-query">${this.translations['form.query']}</label>
                    <input ${ref(this.queryInputRef)} type="text" id="tx-dlf-search-query" placeholder="${this.translations['form.query']}" .value="${this.values.query}">
                    <button type="submit" title="${this.translations['form.search']}">${this.translations['form.search']}</button>

                    <div class="fulltext-switch">
                        <input type="radio" @change="${this.changeFulltext}" name="fulltext" id="form-fulltext-no" value="0" .checked="${!this.values.fulltext}">
                        <label for="form-fulltext-no">${this.translations['search.inMetadata']}</label>
                        <input ${ref(this.fulltextRadioRef)} @change="${this.changeFulltext}" type="radio" name="fulltext" id="form-fulltext-yes" value="1" .checked="${this.values.fulltext}">
                        <label for="form-fulltext-yes">${this.translations['search.inFulltext']}</label>
                    </div>
                </div>
            </form>

            ${loadingBlur(this.loadState === LoadState.NewTerm, html`
                <div class="tx-dlf-listview">
                    <p class="tx-dlf-search-numHits">
                        ${sprintf(this.translations['listview.hits'], [
                            this.searchResults.numHits,
                            this.searchResults.numberOfToplevels,
                        ])}
                    </p>

                    <p class="tx-dlf-sortinfo">
                        ${sprintf(this.translations['sortinfo'], [
                            this.searchResults.params.first,
                            this.searchResults.params.last,
                            this.searchResults.numberOfToplevels,
                        ])}
                    </p>

                    <form method="post" class="tx-dlf-search-form">
                        <div>
                            <label for="form-orderBy">${this.translations['form.orderBy']}</label>
                            <select ${ref(this.orderBySelectRef)} id="form-orderBy" @change=${this.changeOrderBy}>
                                ${this.sortableMetadata.map((meta) => html`
                                    <option value="${meta.indexName}_sorting" .selected="${this.values.orderBy === `${meta.indexName}_sorting`}">
                                        ${meta.label}
                                    </option>
                                `)}
                            </select>

                            <label for="form-order">${this.translations['form.order']}</label>
                            <select ${ref(this.orderSelectRef)} id="form-order" @change=${this.changeOrder} value="${this.values.order}">
                                <option value="asc" .selected="${this.values.order === 'asc'}">${this.translations['form.order.asc']}</option>
                                <option value="desc" .selected="${this.values.order === 'desc'}">${this.translations['form.order.desc']}</option>
                            </select>
                        </div>
                    </form>

                    ${this.renderPager()}

                    ${loadingBlur(this.loadState === LoadState.NewPage, html`
                        <ol class="tx-dlf-abstracts">
                            ${this.searchResults.documents.map((doc) => html`
                                <dlf-listview-item
                                    .translations="${this.translations}"
                                    .listedMetadata="${this.listedMetadata}"
                                    .structures="${this.structures}"
                                    .doc="${doc}"
                                    .searchResults="${this.searchResults}"
                                ></dlf-listview-item>
                            </ol>
                        `)}
                    `)}

                    ${this.renderPager()}
                </div>
            `)}
        `;
    }
}

customElements.define('dlf-listview', ListView);
