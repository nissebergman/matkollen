import { useState } from "react";
import type { Offer } from "../domain/snapshot";
import { productImage } from "../images/catalog";

export function OfferIllustration({ offer }: { offer: Offer }) {
  const image = productImage(offer);
  const [failedId, setFailedId] = useState<string>();
  if (!image || failedId === image.id) {
    return (
      <div className="image-placeholder" role="img" aria-label="Ingen produktbild">
        <svg viewBox="0 0 96 96" fill="none" aria-hidden="true">
          <path d="m27 28 21-10 21 10v40L48 79 27 68V28Z" />
          <path d="m27 28 21 11 21-11M48 39v40M37 23l21 11M36 49v14" />
        </svg>
        <span aria-hidden="true">Bild saknas</span>
      </div>
    );
  }
  return (
    <figure className="offer-product-image">
      <img
        src={`${import.meta.env.BASE_URL}images/products/${image.id}.jpg`}
        alt={`${image.title} (illustrationsbild, inte exakt produkt)`}
        width={192}
        height={192}
        loading="lazy"
        decoding="async"
        onError={() => setFailedId(image.id)}
      />
      <figcaption className="image-credit">
        Illustrationsbild · <a href={image.sourceUrl} title={image.sourceTitle}>{image.author}</a>
        {" · "}<a href={image.licenseUrl}>{image.license}</a>
        <span>Storleksändrad och komprimerad.</span>
      </figcaption>
    </figure>
  );
}
