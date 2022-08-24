/**
 * (c) Kitodo. Key to digital objects e.V. <contact@kitodo.org>
 *
 * This file is part of the Kitodo and TYPO3 projects.
 *
 * @license GNU General Public License version 3 or later.
 * For the full copyright and license information, please read the
 * LICENSE.txt file that was distributed with this source code.
 */

class dlfToolbox {
    constructor() {
        /** @private */
        this.pageLinks = document.querySelectorAll('[data-page-link]');

        document.body.addEventListener('tx-dlf-pageChanged', this.onPageChanged.bind(this));
    }

    /**
     * @private
     * @param {dlf.PageChangeEvent} e
     */
    onPageChanged(e) {
        this.pageLinks.forEach(element => {
            const offset = Number(element.getAttribute('data-page-link'));
            const pageObj = tx_dlf_loaded.document.pages[e.detail.page - 1 + offset];
            if (!pageObj) {
                return;
            }

            const fileGroupsJson = element.getAttribute('data-file-groups');
            const fileGroups = fileGroupsJson
                ? JSON.parse(fileGroupsJson)
                : tx_dlf_loaded.fileGroups['download'];
            const file = dlfUtils.findFirstSet(pageObj.files, fileGroups);
            if (!file) {
                return;
            }

            element.href = file.url;

            const mimetypeLabelEl = element.querySelector('.dlf-mimetype-label');
            if (mimetypeLabelEl !== null) {
                // Transliterated from ToolboxController
                let mimetypeLabel = '';
                switch (file.mimetype) {
                    case 'image/jpeg':
                        mimetypeLabel = ' (JPG)';
                        break;

                    case 'image/tiff':
                        mimetypeLabel = ' (TIFF)';
                        break;
                }

                mimetypeLabelEl.textContent = mimetypeLabel;
            }
        });
    }
}
