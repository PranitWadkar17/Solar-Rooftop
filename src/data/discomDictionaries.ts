// ============================================
// Indian Utility Bill Keyword Dictionaries & Configurations
// ============================================

import type { DiscomKeywordDictionary } from '@/types/bill';

export const DISCOM_DICTIONARIES: Record<string, DiscomKeywordDictionary> = {
  general: {
    discomAliases: [
      'msedcl', 'mahadiscom', 'महावितरण', 'bescom', 'bses', 'rajdhani', 'yamuna', 'tangedco',
      'uppcl', 'torrent', 'tata power', 'adani electricity', 'cesc', 'tsspdcl',
      'tsnpdcl', 'wbsetcl', 'kseb', 'dhbvn', 'uhbvn', 'pspcl', 'apdcl', 'nbpdcl', 'sbpdcl',
    ],
    unitsKeywords: [
      'units billed', 'units consumed', 'total consumption', 'total units',
      'net units', 'billed units', 'consumption (kwh)', 'energy consumed',
      'kwh consumed', 'kwh billed', 'units (kwh)', 'current consumption',
      'total kwh', 'units', 'kwh',
      'एकूण वापर', 'युनिट', 'एकूण युनिट', 'एकूण खपत',
    ],
    loadKeywords: [
      'sanctioned load', 'connected load', 'contract load', 'contract demand',
      'sanc load', 'conn load', 'cd (kw)', 'sl (kw)', 'sanctioned demand',
    ],
    amountKeywords: [
      'total payable', 'net payable', 'amount payable', 'total bill amount',
      'net amount', 'current charges', 'bill amount', 'net demand', 'total due',
      'payable amount', 'grand total', 'gross amount',
    ],
    periodKeywords: [
      'billing period', 'bill period', 'bill duration', 'billing cycle',
      'reading date', 'from date', 'to date', 'bill date',
    ],
    readingKeywords: [
      'current reading', 'present reading', 'previous reading', 'past reading',
      'multiplying factor', 'meter status', 'meter no', 'meter number',
      'चालू रिडिंग', 'मागील रिडिंग', 'गुणक अवयव',
    ],
    consumerKeywords: [
      'consumer no', 'consumer number', 'ca no', 'k no', 'service connection no',
      'account id', 'account no', 'customer id', 'bp no',
    ],
  },
};

export const MONTH_NAMES_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};
