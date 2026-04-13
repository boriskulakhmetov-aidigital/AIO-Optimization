import { useState } from 'react';

interface Props {
  onSubmit: (org: string, brand: string, product: string) => void;
}

export function MobileIntake({ onSubmit }: Props) {
  const [org, setOrg] = useState('');
  const [brand, setBrand] = useState('');
  const [product, setProduct] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!org.trim() || !brand.trim()) return;
    onSubmit(org.trim(), brand.trim(), product.trim());
  }

  return (
    <div className="m-intake">
      <div className="m-intake__hero">
        <h1 className="m-intake__title">How visible is your brand in AI search?</h1>
        <p className="m-intake__subtitle">
          We'll scan 5 AI engines with 50 real queries and show you exactly where you stand.
          Takes about 60 seconds.
        </p>
      </div>

      <form className="m-intake__form" onSubmit={handleSubmit}>
        <div className="m-field">
          <label className="m-field__label" htmlFor="org">Your Organization</label>
          <input
            id="org"
            className="m-field__input"
            type="text"
            placeholder="e.g. Acme Corp"
            value={org}
            onChange={e => setOrg(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="m-field">
          <label className="m-field__label" htmlFor="brand">Brand to Research</label>
          <input
            id="brand"
            className="m-field__input"
            type="text"
            placeholder="e.g. Coca-Cola"
            value={brand}
            onChange={e => setBrand(e.target.value)}
            required
          />
        </div>

        <div className="m-field">
          <label className="m-field__label" htmlFor="product">Product <span className="m-field__optional">(optional)</span></label>
          <input
            id="product"
            className="m-field__input"
            type="text"
            placeholder="e.g. Coca-Cola Zero Sugar"
            value={product}
            onChange={e => setProduct(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="m-btn m-btn--primary m-btn--full"
          disabled={!org.trim() || !brand.trim()}
        >
          Scan Now
        </button>
      </form>
    </div>
  );
}
