export type Region = {
  id: string;
  name: string;
  short: string;
  blurb: string;
};

/** WFAA MyOwnRadar folders linked from the metro hotspot pad. */
export const REGIONS: Region[] = [
  {
    id: "metro40",
    name: "DFW Metro",
    short: "Metro",
    blurb: "Dallas–Fort Worth metro, centered on KFWS",
  },
  {
    id: "main80",
    name: "North Texas",
    short: "North Texas",
    blurb: "Wider view across North Texas",
  },
  {
    id: "nw40",
    name: "Northwest",
    short: "Northwest",
    blurb: "Northwest metro",
  },
  {
    id: "ne40",
    name: "Northeast",
    short: "Northeast",
    blurb: "Northeast metro",
  },
  {
    id: "sw40",
    name: "Southwest",
    short: "Southwest",
    blurb: "Southwest metro",
  },
  {
    id: "se40",
    name: "Southeast",
    short: "Southeast",
    blurb: "Southeast metro",
  },
  {
    id: "tarrantdallas20",
    name: "Tarrant & Dallas",
    short: "Tarrant–Dallas",
    blurb: "Tarrant and Dallas counties",
  },
  {
    id: "dentoncollin20",
    name: "Denton & Collin",
    short: "Denton–Collin",
    blurb: "Denton and Collin counties",
  },
];

export function regionById(id: string): Region {
  return REGIONS.find((region) => region.id === id) ?? REGIONS[0];
}
