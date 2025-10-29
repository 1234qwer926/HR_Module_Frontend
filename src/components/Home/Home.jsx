import React from "react";
import { HeroBullets } from "../HeroBullets/HeroBullets";
import { ContactUs } from "../ContactUs/ContactUs";
import { FeaturesTitle } from "../FeaturesTitle/FeaturesTitle";

const Home = () => {
  return (
    <div>
      <HeroBullets/>
      {/* <FeaturesCards /> */}
      <FeaturesTitle/>
      <ContactUs/>
    </div>
  );
};

export default Home;
