export default function Banner({ heading, headingClassName = 'label', children }) {
  return (
    <section className="banner">
      <div className={headingClassName}>{heading}</div>
      <p>{children}</p>
    </section>
  );
}
