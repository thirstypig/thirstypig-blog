import type { VenueRecord } from './venue-tags';

export interface AggregatedChip {
	label: string;
	total: number;
	venueCount: number;
}

export function aggregateChips(venues: VenueRecord[]): AggregatedChip[] {
	const map = new Map<string, AggregatedChip>();
	for (const v of venues) {
		for (const chip of v.chips) {
			const existing = map.get(chip.label);
			if (existing) {
				existing.total += chip.mention_count;
				existing.venueCount += 1;
			} else {
				map.set(chip.label, { label: chip.label, total: chip.mention_count, venueCount: 1 });
			}
		}
	}
	return [...map.values()].sort((a, b) => b.total - a.total);
}
