interface  CardProps{
    className : string;
    children : JSX.Element | JSX.Element[];
  }
  
  const Card =({className, children}: CardProps) => {
    return (
          <article className={`card ${className}`}>
              {children}
          </article>
    )
  }
  
  export default Card