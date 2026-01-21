import { Branch } from './types';

// LAS Headquarters Location (본사 위치)
export const HEADQUARTERS = {
  lat: 37.5665,  // 서울시청 인근 좌표 (실제 본사 위치로 변경 필요)
  lng: 126.9780,
  name: 'LAS 본사'
};

// Mock Database of Branches in Seoul, Korea
export const BRANCH_DB: Branch[] = [
  {
    id: '1',
    name: 'Gangnam Flagship',
    address: '123 Teheran-ro, Gangnam-gu, Seoul',
    phone: '02-555-1234',
    hours: '09:00 - 22:00',
    lat: 37.4979,
    lng: 127.0276,
    description: 'Our main flagship store located in the heart of Gangnam. Features the full range of premium products and a VIP lounge.',
    manager: 'Kim Min-su'
  },
  {
    id: '2',
    name: 'Hongdae Creative Hub',
    address: '56 Wausan-ro, Mapo-gu, Seoul',
    phone: '02-333-5678',
    hours: '10:00 - 23:00',
    lat: 37.5575,
    lng: 126.9245,
    description: 'Located near Hongik University, this branch focuses on creative tools and hosts weekly workshops.',
    manager: 'Lee Ji-young'
  },
  {
    id: '3',
    name: 'Yeouido Finance Center',
    address: '10 Gukjegeumyung-ro, Yeongdeungpo-gu, Seoul',
    phone: '02-777-9012',
    hours: '08:00 - 20:00',
    lat: 37.5219,
    lng: 126.9243,
    description: 'Serving the business district with express services and corporate solutions.',
    manager: 'Park Sung-hoon'
  },
  {
    id: '4',
    name: 'Itaewon Global Point',
    address: '45 Itaewon-ro, Yongsan-gu, Seoul',
    phone: '02-790-4321',
    hours: '11:00 - 22:00',
    lat: 37.5340,
    lng: 126.9940,
    description: 'Multilingual staff available. Specializes in international shipping and global product lines.',
    manager: 'Sarah Choi'
  },
  {
    id: '5',
    name: 'Jamsil L-Tower',
    address: '300 Olympic-ro, Songpa-gu, Seoul',
    phone: '02-411-8888',
    hours: '10:30 - 22:00',
    lat: 37.5133,
    lng: 127.1001,
    description: 'Located within the mall complex. Large showroom with family-friendly experience zones.',
    manager: 'Jung Woo-sung'
  }
];