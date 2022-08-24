namespace dlf {
    type ResourceLocator = {
        url: string;
        mimetype: string;
    };

    type ImageDesc = ResourceLocator;
    type FulltextDesc = ResourceLocator;

    type PageObject = {
        image?: ImageDesc;
        /**
         * IDs of the logical structures that the page belongs to, ordered by depth.
         */
        logSections: string[];
        fulltext?: dlf.FulltextDesc;
        download?: {
            url: string;
            // TODO: Consider adding MIME type
        };
    };

    type PageChangeEvent = CustomEvent<{
        source: string;
        page: number;
        pageObj: PageObject;
    }>;

    /**
     * State of document stored in `window.history`.
     */
    type PageHistoryState = {
        type: 'tx-dlf-page-state';
        documentId: string | number;
        page: number;
    };
}
