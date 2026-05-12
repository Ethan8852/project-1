// Mock data for StudyCafe Radar (frontend-only prototype)

export const store = {
  name: "집중스터디카페 강남점",
  lastUpdated: "3분 전",
  date: "2026.05.12",
};

export const kpi = {
  weeklyInflow: { value: 1243, changeRate: 18.4, direction: "up" as const },
  searchRank: { value: 3, unit: "위", scope: "지역 내 스터디카페" },
  review: { count: 127, avgRating: 4.6 },
  monthlyVisitors: { estimated: 4820, label: "이번달 예측" },
};

export const daily30 = [
  38, 45, 42, 55, 60, 71, 66, 50, 58, 63, 70, 75, 80, 68, 55,
  60, 72, 85, 90, 78, 82, 95, 100, 110, 98, 88, 105, 112, 118, 125,
].map((inflow, i) => {
  const day = 12 + i;
  const month = day > 30 ? 5 : 4;
  const d = day > 30 ? day - 30 : day;
  return { date: `${month}/${d}`, inflow };
});

export const competitor = {
  myInflow: 1243,
  areaAvgInflow: 892,
  percentile: 23,
  radius: "500m",
  totalStores: 7,
};

export const notifications = [
  { type: "review_unanswered", message: "답글 미작성 리뷰 3건" },
  { type: "rank_change", message: "검색 순위 1단계 상승" },
  { type: "weekly_report", message: "이번 주 리포트 준비됨" },
];

export const health = {
  score: 78,
  grade: "B" as const,
  percentile: 31,
};

export const improvements = [
  { rank: 1, title: "사진 20장 이상 등록", effect: "조회수 +35%", difficulty: "쉬움" as const },
  { rank: 2, title: "리뷰 답글 12건 작성", effect: "신뢰도 +22%", difficulty: "쉬움" as const },
  { rank: 3, title: "영업시간 상세 입력 완성", effect: "노출 +18%", difficulty: "보통" as const },
  { rank: 4, title: "키워드 태그 10개 최적화", effect: "검색순위 +2단계", difficulty: "보통" as const },
  { rank: 5, title: "스마트콜 설정", effect: "전화 유입 +28%", difficulty: "어려움" as const },
];

export const monthly6 = [
  { month: "12월", mine: 680, avg: 750 },
  { month: "1월", mine: 710, avg: 740 },
  { month: "2월", mine: 760, avg: 750 },
  { month: "3월", mine: 830, avg: 760 },
  { month: "4월", mine: 920, avg: 780 },
  { month: "5월", mine: 1040, avg: 800 },
];

export const projects = [
  { name: "포토리뷰 이벤트 기획", roi: 240, costRange: "10~20만원", duration: "2주", description: "리뷰 작성 고객에게 1시간 무료 쿠폰 제공" },
  { name: "시간대별 할인 패키지 도입", roi: 180, costRange: "3~5만원", duration: "1개월", description: "오전 9~11시 공실 타임 30% 할인 패키지" },
  { name: "네이버 플레이스 광고 시작", roi: 320, costRange: "20~40만원", duration: "4주", description: "지역 검색 상단 노출 광고 집행" },
];

export const abTests = {
  active: {
    id: "ab_001",
    name: "썸네일 A(기존) vs B(신규 사진)",
    startDate: "2026-05-05",
    endDate: "2026-05-19",
    progressPercent: 50,
    dayCount: 7,
  },
  completed: [
    { id: "ab_000", name: "영업시간 표기 A vs B", winner: "B", resultA: 12, resultB: 34, confidence: 92, endDate: "2026-04-30" },
  ],
};

export const channels = [
  { name: "네이버 플레이스 광고", spend: 200000, visitors: 890, roi: 320 },
  { name: "인스타그램 광고", spend: 80000, visitors: 340, roi: 180 },
  { name: "오프라인 전단지", spend: 50000, visitors: 120, roi: 80 },
];
