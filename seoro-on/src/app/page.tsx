import Link from 'next/link';

export default function GuidePage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FFFDF5] px-6 py-14">

      {/* 로고 */}
      <div className="mb-12 text-center">
        <span className="text-[5rem]" role="img" aria-label="마이크">🎙</span>
        <h1 className="mt-4 text-[3rem] font-extrabold text-stone-800">서로ON</h1>
        <p className="mt-2 text-[1.6rem] text-stone-500">내 이야기를 담아두는 공간</p>
      </div>

      {/* 사용 방법 */}
      <div className="mb-12 space-y-4">
        {(
          [
            { step: '1', emoji: '❓', text: '오늘의 질문을 골라요' },
            { step: '2', emoji: '🎙', text: '버튼을 눌러 이야기해요' },
            { step: '3', emoji: '✅', text: '완료를 눌러 저장해요' },
            { step: '4', emoji: '🎧', text: '나중에 다시 들을 수 있어요' },
          ] as const
        ).map(({ step, emoji, text }) => (
          <div
            key={step}
            className="flex items-center gap-5 rounded-2xl bg-white px-6 py-5 shadow-sm"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1B6CA8] text-[1.4rem] font-bold text-white">
              {step}
            </span>
            <span className="text-[2rem]" role="img" aria-hidden>{emoji}</span>
            <p className="text-[1.8rem] font-semibold text-stone-700">{text}</p>
          </div>
        ))}
      </div>

      {/* 시작 버튼 */}
      <Link
        href="/senior/question-select"
        className="flex h-[90px] w-full items-center justify-center rounded-2xl bg-[#1B6CA8] shadow-xl transition-transform active:scale-95"
      >
        <span className="text-[2.2rem] font-extrabold text-white">시작하기</span>
      </Link>
    </div>
  );
}
