import { Swiper, SwiperSlide } from 'swiper/react';
import './carousel.scss';
import { Navigation } from 'swiper/modules';

export const Carousel=()=> {
  return (
    <>
      <Swiper navigation={true} modules={[Navigation]} className="mySwiper">
        <SwiperSlide><img src="/images/fund-1.svg" alt="" className="second-image" /></SwiperSlide>
        <SwiperSlide><img src="/images/fund-4.svg" alt="" className="second-image" /></SwiperSlide>
        <SwiperSlide><img src="/images/fund-5.svg" alt="" className="second-image" /></SwiperSlide>
        {/* <SwiperSlide>Slide 4</SwiperSlide>
        <SwiperSlide>Slide 5</SwiperSlide>
        <SwiperSlide>Slide 6</SwiperSlide>
        <SwiperSlide>Slide 7</SwiperSlide>
        <SwiperSlide>Slide 8</SwiperSlide>
        <SwiperSlide>Slide 9</SwiperSlide> */}
      </Swiper>
        
                
                
    </>
  );
}
export default Carousel ;