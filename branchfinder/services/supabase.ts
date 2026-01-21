import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Branch } from '../types';
import { addressToCoordinates } from './geocoding';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables');
}

export const supabase: SupabaseClient | null = (supabaseUrl && supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export const fetchBranches = async (): Promise<Branch[]> => {
    if (!supabase) {
        console.warn('Supabase client not initialized. Returning empty list.');
        return [];
    }

    const { data, error } = await supabase
        .from('branches')
        .select('*');

    if (error) {
        console.error('Error fetching branches:', error);
        return [];
    }

    // Process branches to fix missing coordinates
    const parseCoord = (value: any) => {
        if (value === null || value === undefined || value === '') return null;
        const num = Number(value);
        if (!Number.isFinite(num)) return null;
        if (num === 0) return null;
        return num;
    };

    const branches = await Promise.all(data.map(async (item: any) => {
        let lat = parseCoord(item.lat);
        let lng = parseCoord(item.lng);

        // Auto-fix: Calculate location if missing and address exists
        if ((lat === null || lng === null) && item.address) {
            console.log(`Missing coordinates for ${item.name}, attempting to geocode...`);
            const coords = await addressToCoordinates(item.address);
            
            if (coords) {
                lat = coords.lat;
                lng = coords.lng;
                
                // Update Supabase with new coordinates
                const { error: updateError } = await supabase
                    .from('branches')
                    .update({ lat, lng })
                    .eq('id', item.id);
                    
                if (updateError) {
                    console.error(`Failed to update coordinates for ${item.name}:`, updateError);
                } else {
                    console.log(`Successfully updated coordinates for ${item.name}`);
                }
            } else {
                console.warn(`Could not geocode address for ${item.name}: ${item.address}`);
            }
        }

        return {
            id: item.id,
            name: item.name,
            address: item.address,
            phone: item.phone,
            hours: item.hours,
            lat: lat ?? Number.NaN,
            lng: lng ?? Number.NaN,
            description: item.description,
            manager: item.manager
        };
    }));

    return branches as Branch[];
};

/**
 * Create a new branch with automatic geocoding
 * @param branchData - Branch data (lat/lng will be auto-generated from address if not provided)
 * @returns Created branch or null if failed
 */
export const createBranch = async (
    branchData: Omit<Branch, 'id' | 'lat' | 'lng'> & { lat?: number; lng?: number }
): Promise<Branch | null> => {
    if (!supabase) {
        console.error('Supabase client not initialized');
        return null;
    }

    const parseCoord = (value: any) => {
        if (value === null || value === undefined || value === '') return null;
        const num = Number(value);
        if (!Number.isFinite(num)) return null;
        if (num === 0) return null;
        return num;
    };
    let lat = parseCoord(branchData.lat);
    let lng = parseCoord(branchData.lng);

    // If coordinates are not provided, geocode the address
    if (lat === null || lng === null) {
        console.log('Geocoding address:', branchData.address);
        const coordinates = await addressToCoordinates(branchData.address);

        if (!coordinates) {
            console.error('Failed to geocode address:', branchData.address);
            return null;
        }

        lat = coordinates.lat;
        lng = coordinates.lng;
        console.log('Geocoded coordinates:', { lat, lng });
    }

    const { data, error } = await supabase
        .from('branches')
        .insert([
            {
                name: branchData.name,
                address: branchData.address,
                phone: branchData.phone,
                hours: branchData.hours || '',
                lat,
                lng,
                description: branchData.description,
                manager: branchData.manager,
            }
        ])
        .select()
        .single();

    if (error) {
        console.error('Error creating branch:', error);
        return null;
    }

    return data as Branch;
};
