<?php

/**
 * (c) Kitodo. Key to digital objects e.V. <contact@kitodo.org>
 *
 * This file is part of the Kitodo and TYPO3 projects.
 *
 * @license GNU General Public License version 3 or later.
 * For the full copyright and license information, please read the
 * LICENSE.txt file that was distributed with this source code.
 */

namespace Kitodo\Dlf\Eid;

use Kitodo\Dlf\Common\Helper;
use Kitodo\Dlf\Domain\Repository\CollectionRepository;
use Kitodo\Dlf\Domain\Repository\DocumentRepository;
use Kitodo\Dlf\Domain\Repository\MetadataRepository;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use TYPO3\CMS\Core\Configuration\ExtensionConfiguration;
use TYPO3\CMS\Core\Http\JsonResponse;
use TYPO3\CMS\Core\Http\RequestFactory;
use TYPO3\CMS\Core\Http\Response;
use TYPO3\CMS\Core\Utility\GeneralUtility;
use TYPO3\CMS\Extbase\Mvc\Web\Routing\UriBuilder;
use TYPO3\CMS\Extbase\Object\ObjectManager;
use TYPO3\CMS\Extbase\Persistence\Generic\Typo3QuerySettings;

/**
 *
 * @package TYPO3
 * @subpackage dlf
 * @access public
 */
class SolrSearch
{
    /**
     * @var RequestFactory
     */
    protected $requestFactory;

    /**
     * @var mixed
     */
    protected $extConf;

    public function __construct()
    {
        $this->requestFactory = GeneralUtility::makeInstance(RequestFactory::class);
        $this->extConf = GeneralUtility::makeInstance(ExtensionConfiguration::class)->get('dlf');
    }

    /**
     * Handle a GET request.
     *
     * @param ServerRequestInterface $request
     * @return ResponseInterface
     */
    protected function handleGet(ServerRequestInterface $request): ResponseInterface
    {
        $queryParams = $request->getQueryParams();

        $settings = json_decode(Helper::decrypt((string) $queryParams['settings']), true);
        if (!is_array($settings)) {
            return new JsonResponse(['message' => 'Could not decode settings'], 400);
        }

        $solrCoreName = (string) ($settings['solrcore'] ?? '');
        $storagePid = (int) ($settings['storagePid'] ?? 0);
        $pageViewPid = (int) ($settings['pageViewPid'] ?? 0);
        if (empty($solrCoreName) || empty($storagePid) || empty($pageViewPid)) {
            return new JsonResponse(['message' => 'Invalid settings'], 400);
        }

        $pageSize = max(1, (int) ($settings['paginate']['itemsPerPage'] ?? 25));
        $collectionsStr = (string) ($settings['collections'] ?? '');

        $term = (string) ($queryParams['term'] ?? '*');
        $orderBy = (string) ($queryParams['orderBy'] ?? '');
        $order = (string) ($queryParams['order'] ?? 'asc');
        $page = max(0, intval($queryParams['page'] ?? '0'));
        $fulltext = $queryParams['fulltext'] == 1;

        $objectManager = GeneralUtility::makeInstance(ObjectManager::class);
        $querySettings = $objectManager->get(Typo3QuerySettings::class);
        $querySettings->setStoragePageIds([$storagePid]);
        $documentRepository = $objectManager->get(DocumentRepository::class);
        $documentRepository->setDefaultQuerySettings($querySettings);
        $collectionRepository = $objectManager->get(CollectionRepository::class);
        $collectionRepository->setDefaultQuerySettings($querySettings);
        $metadataRepository = $objectManager->get(MetadataRepository::class);
        $metadataRepository->setDefaultQuerySettings($querySettings);

        $uriBuilder = $objectManager->get(UriBuilder::class);

        $searchParams = [
            'query' => $term,
            'fulltext' => $fulltext,
        ];

        if (!empty($orderBy) && ($order === 'asc' || $order === 'desc')) {
            $searchParams['orderBy'] = $orderBy;
            $searchParams['order'] = $order;
        }

        $collections = null;
        $collectionsArr = GeneralUtility::intExplode(',', $collectionsStr, true);
        if (!empty($collectionsArr)) {
            $collections = $collectionRepository->findAllByUids($collectionsArr);
        }
        if (empty($collections) || count($collections) === 0) {
            // If a collection ID has been given, but all are invalid...
            $collections = null;
        }

        $listedMetadata = $metadataRepository->findByIsListed(true);
        $solrSettings = [
            'solrcore' => $solrCoreName,
            'storagePid' => $storagePid,
        ];
        $solrSearch = $documentRepository->findSolrByCollection($collections, $solrSettings, $searchParams, $listedMetadata);
        $query = $solrSearch->getQuery();
        $query->setOffset($page * $pageSize);
        $query->setLimit($pageSize);
        $documents = $query->execute();

        // TODO: Performance. URL generation seems to be slow. Avoid cHash generation?
        foreach ($documents as $docIdx => $document) {
            // TODO: Test that it works with slugs
            $documents[$docIdx]['pageLink'] = $uriBuilder->reset()
                ->setTargetPageUid($pageViewPid)
                ->setCreateAbsoluteUri(true)
                ->setArguments([
                    'tx_dlf[id]' => $document['uid'],
                ])
                ->build();

            foreach ($document['searchResults'] ?? [] as $resultIdx => $result) {
                $documents[$docIdx]['searchResults'][$resultIdx]['pageLink'] = $uriBuilder->reset()
                    ->setTargetPageUid($pageViewPid)
                    ->setCreateAbsoluteUri(true)
                    ->setArguments([
                        'tx_dlf[id]' => $result['uid'],
                        'tx_dlf[page]' => $result['page'],
                        'tx_dlf[highlight_word]' => $result['highlight_word'],
                    ])
                    ->build();
            }

            foreach ($document['children'] ?? [] as $childIdx => $child) {
                $documents[$docIdx]['children'][$childIdx]['pageLink'] = $uriBuilder->reset()
                    ->setTargetPageUid($pageViewPid)
                    ->setCreateAbsoluteUri(true)
                    ->setArguments([
                        'tx_dlf[id]' => $child['uid'],
                    ])
                    ->build();
            }
        }

        $result = [
            'params' => [
                'pageSize' => $pageSize,
                'first' => $query->getOffset() + 1,
                'last' => $query->getOffset() + count($documents),
            ],
            'numberOfToplevels' => count($solrSearch),
            'numHits' => $solrSearch->getNumHits(),
            'documents' => $documents,
        ];

        return new JsonResponse($result, 200);
    }

    /**
     * The main method of the eID script
     *
     * @access public
     *
     * @param ServerRequestInterface $request
     * @return ResponseInterface
     */
    public function main(ServerRequestInterface $request)
    {
        switch ($request->getMethod()) {
            case 'GET':
                return $this->handleGet($request);

            default:
                // 405 Method Not Allowed
                return GeneralUtility::makeInstance(Response::class)
                    ->withStatus(405);
        }
    }
}
