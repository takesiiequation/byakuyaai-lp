import type { ActivePropertyVideo, CustomerData, PropertyVideo } from './types';
import { customers } from './_registry';
import { validateCustomerData } from '../_lib/validate';

customers.forEach((customer) => {
  validateCustomerData(customer);
});

function isActiveProperty(property: PropertyVideo): property is ActivePropertyVideo {
  return property.status === 'active';
}

export function getCustomerBySlug(slug: string): CustomerData | undefined {
  return customers.find((customer) => customer.slug === slug);
}

export function getActiveProperties(customer: CustomerData): ActivePropertyVideo[] {
  return customer.properties.filter(isActiveProperty);
}

export function getAllActiveSlugs(): string[] {
  return customers
    .filter((customer) => getActiveProperties(customer).length > 0)
    .map((customer) => customer.slug);
}
