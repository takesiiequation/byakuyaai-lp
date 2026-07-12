export type PropertyStatus = 'active' | 'closed';

export type TradeType = '仲介' | '貸主' | '代理';

export interface PropertyVideo {
  id: string;
  title: string;
  area: string;
  address: string;
  rentMan: number;
  managementFeeYen: number;
  depositMan: number;
  keyMoneyMan: number;
  layout: string;
  sizeSqm: number;
  walkMin: number;
  structure?: string;
  availableFrom?: string;
  videoUrl: string;
  posterUrl: string;
  status: PropertyStatus;
  tags: string[];
  description?: string;
  stationName?: string;
  floor?: string;
  buildingAge?: number;
  order?: number;
  uploadDate: string;
  videoDurationSec?: number;
  aspect?: '9:16' | '1:1' | '16:9';
}

export type ActivePropertyVideo = Omit<PropertyVideo, 'status'> & {
  status: 'active';
};

export interface CustomerAddress {
  postalCode?: string;
  prefecture: string;
  city: string;
  streetAddress?: string;
}

export interface CustomerData {
  slug: string;
  company: string;
  licenseNo: string;
  lineUrl: string;
  tel: string;
  logoUrl: string;
  catchCopy: string;
  tradeType: TradeType;
  address?: CustomerAddress;
  companyDescription?: string;
  properties: PropertyVideo[];
}
