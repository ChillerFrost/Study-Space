export default function PageHeader({ title, description, tag }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      <div className="page-tag">{tag}</div>
    </div>
  );
}
