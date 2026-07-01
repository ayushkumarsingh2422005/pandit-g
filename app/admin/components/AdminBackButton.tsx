import Link from "next/link";

type Props = {
  href?: string;
  label?: string;
};

export function AdminBackButton({
  href = "/admin/chats",
  label = "Back",
}: Props) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="-ml-1 flex shrink-0 items-center justify-center rounded-full p-2 text-[#e9edef] transition hover:bg-[#2a3942] md:hidden"
    >
      <svg
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 19l-7-7 7-7"
        />
      </svg>
    </Link>
  );
}
