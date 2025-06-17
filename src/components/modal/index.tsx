import { IoClose } from "react-icons/io5";
import "./modal.scss";

export const PaymentModal = ({ closeModal }: { closeModal: (value: boolean) => void }) => {
  return (
    <>
      <div className="upumi-payment-modal">
        <div className="upumi-payment-overlay"></div>
        <div className="upumi-payment-modal-content">
          <div className="upumi-close-section">
            <img 
              src="/images/HandCoins.svg" 
              alt="Hand holding coins" 
              className="upumi-hand-coin" 
            />
            <button 
              className="upumi-close-button" 
              onClick={() => closeModal(false)}
              aria-label="Close payment modal"
            >
              <IoClose />
            </button>
          </div>
          
          <h1 className="upumi-payment-heading">Payment Information</h1>
          <p className="upumi-payment-description">
            Use the payment information to make donations.
          </p>
          
          <div className="upumi-payment-methods">
            <div className="upumi-payment-method">
              <img src="/images/CashApp.svg" alt="Cash App logo" />
              <div className="upumi-payment-info">
                <p className="upumi-payment-text">
                  Cashapp: <span className="upumi-payment-link">$upumi</span>
                </p>
              </div>
            </div>

            <div className="upumi-payment-method">
              <img src="/images/Zelle.svg" alt="Zelle logo" />
              <div className="upumi-payment-info">
                <p className="upumi-payment-text">
                  Zelle: <span className="upumi-payment-link">Upumisecretary@gmail.com</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PaymentModal;