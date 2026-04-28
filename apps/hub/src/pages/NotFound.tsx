import { Link } from "wouter";

export function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <p className="text-6xl font-bold text-zinc-300">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-900">페이지를 찾을 수 없습니다</h1>
      <p className="mt-2 text-zinc-600">
        주소가 잘못되었거나 아직 마운트되지 않은 앱일 수 있습니다.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
      >
        홈으로
      </Link>
    </div>
  );
}
