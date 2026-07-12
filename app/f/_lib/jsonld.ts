import type { ActivePropertyVideo, CustomerData } from '../_data/types';
import { absoluteUrl } from './site';

interface JsonLdGraph {
  '@context': string;
  '@graph': Record<string, unknown>[];
}

export function buildGraph(
  customer: CustomerData,
  active: ActivePropertyVideo[],
  pageUrl: string
): JsonLdGraph {
  const url = absoluteUrl(pageUrl);
  const agentId = `${url}#agent`;

  const agentAddress = customer.address && {
    '@type': 'PostalAddress',
    ...(customer.address.postalCode && { postalCode: customer.address.postalCode }),
    addressRegion: customer.address.prefecture,
    addressLocality: customer.address.city,
    ...(customer.address.streetAddress && { streetAddress: customer.address.streetAddress }),
  };

  const realEstateAgent: Record<string, unknown> = {
    '@type': 'RealEstateAgent',
    '@id': agentId,
    name: customer.company,
    url,
    telephone: customer.tel,
    logo: absoluteUrl(customer.logoUrl),
    ...(agentAddress && { address: agentAddress }),
    ...(customer.companyDescription && { description: customer.companyDescription }),
    additionalProperty: [
      { '@type': 'PropertyValue', name: '宅建業免許番号', value: customer.licenseNo },
      { '@type': 'PropertyValue', name: '取引形態', value: customer.tradeType },
    ],
  };

  const listingNodes = active.flatMap((property) => {
    if (!property.uploadDate) {
      throw new Error(`jsonld: uploadDate is required (propertyId=${property.id})`);
    }

    const videoId = `${url}#video-${property.id}`;
    const listingId = `${url}#listing-${property.id}`;
    const offerId = `${url}#offer-${property.id}`;
    const priceYen = Math.round(property.rentMan * 10000);

    const videoObject: Record<string, unknown> = {
      '@type': 'VideoObject',
      '@id': videoId,
      name: property.title,
      description: property.description ?? property.title,
      thumbnailUrl: absoluteUrl(property.posterUrl),
      contentUrl: absoluteUrl(property.videoUrl),
      uploadDate: property.uploadDate,
      ...(property.videoDurationSec && { duration: `PT${property.videoDurationSec}S` }),
    };

    const offer: Record<string, unknown> = {
      '@type': 'Offer',
      '@id': offerId,
      price: priceYen,
      priceCurrency: 'JPY',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: priceYen,
        priceCurrency: 'JPY',
        unitText: '月',
      },
      url,
      seller: { '@id': agentId },
    };

    const additionalProperties: Record<string, unknown>[] = [
      { '@type': 'PropertyValue', name: '部屋タイプ', value: property.layout },
      { '@type': 'PropertyValue', name: '管理費', value: property.managementFeeYen, unitText: 'JPY/月' },
      { '@type': 'PropertyValue', name: '敷金', value: property.depositMan, unitText: '万円' },
      { '@type': 'PropertyValue', name: '礼金', value: property.keyMoneyMan, unitText: '万円' },
      { '@type': 'PropertyValue', name: '徒歩分', value: property.walkMin, unitText: '分' },
    ];

    if (property.stationName) {
      additionalProperties.push({ '@type': 'PropertyValue', name: '最寄り駅', value: property.stationName });
    }
    if (property.structure) {
      additionalProperties.push({ '@type': 'PropertyValue', name: '構造', value: property.structure });
    }
    if (property.floor) {
      additionalProperties.push({ '@type': 'PropertyValue', name: '階数', value: property.floor });
    }
    if (property.buildingAge !== undefined) {
      additionalProperties.push({ '@type': 'PropertyValue', name: '築年数', value: property.buildingAge, unitText: '年' });
    }
    if (property.availableFrom) {
      additionalProperties.push({ '@type': 'PropertyValue', name: '入居可能日', value: property.availableFrom });
    }

    const realEstateListing: Record<string, unknown> = {
      '@type': 'RealEstateListing',
      '@id': listingId,
      name: property.title,
      url,
      description: property.description ?? property.title,
      datePosted: property.uploadDate,
      address: {
        '@type': 'PostalAddress',
        addressLocality: property.area,
        streetAddress: property.address,
      },
      floorSize: {
        '@type': 'QuantitativeValue',
        value: property.sizeSqm,
        unitCode: 'MTK',
      },
      ...(property.tags.length > 0 && { keywords: property.tags.join(', ') }),
      additionalProperty: additionalProperties,
      offers: offer,
      provider: { '@id': agentId },
      video: { '@id': videoId },
    };

    return [videoObject, realEstateListing];
  });

  return {
    '@context': 'https://schema.org',
    '@graph': [realEstateAgent, ...listingNodes],
  };
}
