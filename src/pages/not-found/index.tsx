import "./404.scss"


const PageNotFound = () => {


    return (
        <>
    <div className="page-not-found">
    <div className="container">
        <div className="error-code">
            <img className="main-image" src="/images/404.svg" alt="404 Not Found" />
            </div>
        <p className="message">Sorry, We were unable to find that page.</p>
        <a href="/" className="button">Back to Homepage</a>
    </div>
    </div>
        </>
    );
};


export default PageNotFound;
