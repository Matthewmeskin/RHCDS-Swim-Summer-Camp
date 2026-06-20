export default function SpecialNeedsBanner() {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-brand-amber px-4 py-3 text-brand-text">
      <span aria-hidden className="text-lg leading-none">
        ⚠️
      </span>
      <p className="text-sm font-semibold">
        This student has a special needs note — please read carefully before the
        lesson
      </p>
    </div>
  );
}
