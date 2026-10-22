/* Character content tables. Edit freely: this is data, not logic. */
window.CharacterData = {
  firstNames: {
    male: ["Aldric","Berren","Cael","Doran","Edmund","Fenn","Garrick","Hale","Ivor","Joren","Kellan","Lorcan","Marek","Nolan","Osric"],
    female: ["Alara","Brenna","Cora","Dalia","Elspeth","Fiora","Gwen","Helene","Isolde","Jenna","Kestrel","Lyra","Maren","Nessa","Orla"]
  },
  surnames: ["Ashford","Blackwood","Carrow","Dunmere","Eastwick","Fairwind","Grayson","Hollis","Ironside","Kerrigan","Langley","Marsh","Northcott","Oakheart","Pryce"],
  ageRange: [16, 75],
  traits: ["Brave","Cowardly","Honest","Deceitful","Curious","Stubborn","Generous","Greedy","Patient","Hot-tempered",
           "Loyal","Ambitious","Lazy","Cheerful","Gloomy","Cautious","Reckless","Charming","Shy","Proud",
           "Humble","Suspicious","Trusting","Clever","Forgetful","Kind","Cruel","Devout","Superstitious","Witty"],
  // Traits that can't appear on the same character.
  opposites: [["Brave","Cowardly"],["Honest","Deceitful"],["Generous","Greedy"],["Patient","Hot-tempered"],["Cheerful","Gloomy"],
              ["Cautious","Reckless"],["Shy","Charming"],["Proud","Humble"],["Suspicious","Trusting"],["Kind","Cruel"]]
};
