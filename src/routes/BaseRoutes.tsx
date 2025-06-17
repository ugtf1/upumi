import { Routes, Route } from "react-router-dom";

import { About, Alumni, Events, Home, } from "../pages";


const BaseRoute = () => {
    return (
        <Routes>
            {/* Public routes */}
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About/>} />
            <Route path="/events" element={<Events/>} />
            <Route path="/alumni" element={<Alumni/>} />
            {/* Catch-all route for 404 */}
            {/* <Route path="*" element={<PageNotFound />} /> */}
        </Routes>
    );
};

export default BaseRoute;