import { stripeTestPaymentCopy } from '../i18n/stripe-test-payment';

type Props = {
  productId: string;
  size: string;
  quantity: number;
  price: number;
  currency: string;
  language: 'en' | 'ar';
};

const MUSK_TEST_PAYMENT_LINK = 'https://buy.stripe.com/test_bJecMYc1Ua6K99zaz4gnK00';

export function MuskTestPaymentLink(props: Props) {
  if (
    props.productId !== 'musk' ||
    props.size !== '50ml' ||
    props.quantity !== 1 ||
    props.price !== 13 ||
    props.currency !== 'KWD'
  ) return null;

  const copy = stripeTestPaymentCopy[props.language];
  return (
    <section className="stripe-test-payment" aria-label={copy.label}>
      <p className="stripe-test-payment-label">{copy.label}</p>
      <a
        className="cta-primary stripe-test-payment-button"
        href={MUSK_TEST_PAYMENT_LINK}
        target="_blank"
        rel="noopener noreferrer"
        referrerPolicy="no-referrer"
        aria-describedby="musk-test-payment-description"
        data-testid="musk-stripe-test-payment-link"
      >
        {copy.button}
      </a>
      <p id="musk-test-payment-description">{copy.description}</p>
    </section>
  );
}
