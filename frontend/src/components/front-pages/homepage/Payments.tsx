import { Icon } from "@iconify/react";

export const PaymentOptions = () => {
  const paymentOptions = [
    {
      key: "option1",
      icon: "logos:visa",
      name: "Visa"
    },
    {
      key: "option2", 
      icon: "logos:mastercard",
      name: "Mastercard"
    },
    {
      key: "option3",
      icon: "logos:paypal",
      name: "PayPal"
    },
    {
      key: "option4",
      icon: "simple-icons:stripe", 
      name: "Stripe"
    },
    {
      key: "option5",
      icon: "simple-icons:mercadopago",
      name: "MercadoPago"
    },
    {
      key: "option6",
      icon: "simple-icons:pse",
      name: "PSE"
    },
  ];
  
  return (
    <>
      <div className="px-4 pt-12 dark:bg-dark">
        <p className="text-base text-ld opacity-90 text-center mb-8">
          Pago seguro con múltiples opciones disponibles
        </p>
        <div className="flex flex-wrap items-center justify-center md:gap-14 gap-7">
          {paymentOptions.map((item) => {
            return (
              <div key={item.key} className="flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
                <Icon icon={item.icon} className="text-3xl" />
                <span className="text-sm font-medium text-ld">{item.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};
