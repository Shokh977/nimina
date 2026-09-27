/** Label above every inspector control, per spec: 12.5px/600 #c9cdd8, 9px
 * gap to the control beneath it. */
export default function SectionLabel({ children, trailing }: { children: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <div className="mb-[9px] flex items-center justify-between gap-2">
      <span className="text-[12.5px] font-semibold text-[#c9cdd8]">{children}</span>
      {trailing}
    </div>
  );
}
