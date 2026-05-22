import { IoClose } from "react-icons/io5";
import "./sliders-modal.scss";

const SliderModal = ({ children, isOpen, onClose }: { 
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
}) => {
  if (!isOpen) return null;

  return (
    <div className="upumi-carousel-modal">
      <div className="upumi-carousel-modal-wrapper">
        <div className="upumi-carousel-modal-content">
          <button 
            onClick={onClose} 
            className="upumi-close-button"
            aria-label="Close modal"
          >
            <IoClose />
          </button>
          {children}
        </div>
      </div>
    </div>
  );
};

export default SliderModal;