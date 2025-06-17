interface  CardProps{
    closeModal: () => void;
    className : string;
    children : JSX.Element | JSX.Element[];
  }
  
  const GeneralModal =({className, children, closeModal}: CardProps) => {
    return (
          <article className={`card ${className}`}>
              <div className="overlay" onClick={closeModal}></div>
              {children}
          </article>
    )
  }
  
  export default GeneralModal 