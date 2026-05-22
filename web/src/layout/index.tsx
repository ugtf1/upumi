import { Routes, Route } from 'react-router-dom';

import './layout.scss';
import BaseRoute from "../routes/BaseRoutes";
import { Navbar } from '../components';

const Layout = () => {
    return (
        <div className='layout'>
            <Navbar />
            <Routes>
                <Route path='/*' element={<BaseRoute />} />
            </Routes>
            
           
        </div>
    )
};

export default Layout;