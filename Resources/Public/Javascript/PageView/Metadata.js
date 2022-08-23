/**
 * (c) Kitodo. Key to digital objects e.V. <contact@kitodo.org>
 *
 * This file is part of the Kitodo and TYPO3 projects.
 *
 * @license GNU General Public License version 3 or later.
 * For the full copyright and license information, please read the
 * LICENSE.txt file that was distributed with this source code.
 */

const dlfRootline = {
    /**
     * Only the metadata of the current logical element is shown.
     */
    None: 0,
    /**
     * All rootline metadata is shown.
     */
    All: 1,
    /**
     * Only titledata (toplevel) is shown.
     */
    Titledata: 2,
};

/**
 * Handle dynamic changes to the metadata plugin.
 * - Update visibility of sections depending on page
 */
class dlfMetadata {
    /**
     *
     * @param {object} config
     * @param {0 | 1 | 2} config.rootline Rootline configuration, see enum {@link dlfRootline}.
     */
    constructor(config) {
        /** @protected */
        this.config = config;

        document.body.addEventListener('tx-dlf-pageChanged', this.onPageChanged.bind(this));
    }

    /**
     * @private
     * @param {dlf.PageChangeEvent} e
     */
    onPageChanged(e) {
        const { pageObj } = e.detail;

        document.querySelectorAll('[data-dlf-section]').forEach((element) => {
            element.hidden = !this.shouldShowSection(pageObj, element.getAttribute('data-dlf-section'));
        });
    }

    /**
     * @protected
     * @param {dlf.PageObject} pageObj
     * @param {string} section
     */
    shouldShowSection(pageObj, section) {
        switch (this.config.rootline) {
            case dlfRootline.None:
            default:
                return section === pageObj.logSections[0];

            case dlfRootline.All:
                return pageObj.logSections.includes(section);

            case dlfRootline.Titledata:
                return section === pageObj.logSections[pageObj.logSections.length - 1];
        }
    }
}
