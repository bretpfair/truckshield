export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"
];

export const BUSINESS_CATEGORIES = [
  "Agricultural","Automobile Haulers (Double Deck)","Automobile Haulers (Single Deck)","Boat Haulers",
  "Bulk","Contractors & Construction Services","Courier (Packaging Service)","Double/Triple Trailers",
  "Dry Van/Box","Dump (Permly Att Body)","Dump (Semi Trailer)","Flatbed","Garbage/Refuse Haulers",
  "Hazardous Materials","Hot Shot","Household Goods (Movers)","Intermodal/Containers","Livestock Haulers",
  "Local Delivery","Logging","Mobile Home Hauler","Radioactive Materials","Refrigerated","Straight Truck",
  "Tanker (Hazmat)","Tanker (Non-Hazmat)","Towing"
];

export const CONTRACTOR_TYPES = [
  "Cabinet Installers","Carpenters","Cleaning Services","Commercial Construction Services",
  "Commercial Equipment Installation","Concrete Contractors","Debris Removal Services","Demolition Services",
  "Drywall Contractors","Electrical Contractors","Equipment Rental & Leasing","Excavation Services",
  "Flooring Contractors","General Contractors","General Engineering Contractor","General Maintenance Services",
  "Handyman Services","Heating & Air Contractors","Heavy Construction","Home Improvement Contractors",
  "Insulation Installers","Janitorial Services","Landscapers","Masonry/Brick/Stone Contractors",
  "Painting Contractors","Plumbing Contractors","Pool Services","Restoration Services",
  "Roofing Contractors","Welding Services","Window/Glass"
];

export const BUSINESS_TYPES = ["Individual", "Partnership", "Corporation/LLC"];
export const CARRIER_AUTHORITY_PREFIXES = ["DOT", "MC", "ST", "N/A"];

export const PRIMARY_BIPD_LIMITS = ["$1,000,000", "$750,000", "$500,000", "$300,000", "$100,000"];
export const GL_OPTIONS = ["No Coverage", "$500K/$1M", "$1M/$1M", "$1M/$2M"];
export const DEDUCTIBLE_OPTIONS = ["$1,000", "$2,500", "$5,000"];
export const CARGO_VEHICLE_LIMITS = ["$25K", "$50K", "$75K", "$100K", "$150K", "$200K", "$250K"];
export const TRAILER_INTERCHANGE_OPTIONS = [
  "No Coverage","$15K","$20K","$25K","$30K","$35K","$40K","$45K","$50K","$55K","$60K","$70K","$80K"
];

export const DISTANCE_RANGES = [
  "0 – 25 miles","25 – 50 miles","50 – 100 miles","100 – 200 miles","200 – 300 miles",
  "300 – 500 miles","500 – 1,000 miles","1,000 – 1,500 miles","Over 1,500 miles"
];

export const COMMODITY_CLASSES = [
  { name: "General/Dry Van", items: ["Appliances (Major)","Appliances (Small)","Beverage (Non-Alcoholic)","Bottles (Plastic)","Canned Goods","Clothing","Electronic Accessories","Paper/Paper Products","Plastic Products","Shoes","General Merchandise"] },
  { name: "Refrigerated", items: ["Frozen Foods","Dairy Products","Fresh Produce","Meat/Poultry","Seafood","Pharmaceuticals"] },
  { name: "Bulk Commodities", items: ["Grain","Sand/Gravel","Coal","Cement","Chemicals (Non-Hazmat)","Fertilizer"] },
  { name: "Flatbed/Heavy Equip.", items: ["Steel/Metal","Lumber","Construction Materials","Heavy Equipment","Machinery","Pipe"] },
  { name: "Motor Vehicle Transport", items: ["New Automobiles","Used Automobiles","Motorcycles","RVs","Boats"] },
  { name: "Livestock Haulers", items: ["Cattle","Hogs","Poultry","Horses","Other Livestock"] },
];

export const GVW_CLASSES = ["Class 1","Class 2","Class 3","Class 4","Class 5","Class 6","Class 7","Class 8"];
export const TRUCK_TYPES = [
  "Truck Tractor","Straight Truck","Pickup Truck","Cargo Van","Dump Truck","Coal Truck",
  "Garbage Truck","Tow Truck","Tank Truck","Private Passenger"
];
export const TRUCK_MAKES = [
  "Chevrolet","Crane Carrier","Dodge","Ford","Freightliner","GMC","Hino","International","Isuzu",
  "Kenworth","Mack","Mercedes","Mitsubishi","Mitsubishi Fuso","Nissan","Other","Ottawa","Peterbilt",
  "Ram","Sterling","Tesla","Toyota","UD Trucks","Volvo","Western Star"
];
export const TRAILER_TYPES = [
  "Auto Hauler","Box (Straight Truck)","Bulker","Curtain Side Van","Delivery Van","Drop Frame",
  "Dry Van/Box","Dump Trailer (Tilt)","Dump Trailer (Bottom)","Enclosed","Flatbed","Gooseneck",
  "Grain","Heavy Equipment","Hopper","Intermodal/Container","Livestock","Live Floor","Logging",
  "Lowboy","Open Top","Platform","Pole","Reefer","Roll-Off","Side Dump","Step Deck","Tanker",
  "Tipper","Utility"
];
export const TRAILER_MAKES = [
  "Aspen","Barrett","Beall","Benson","Big Tex","Brenner Tank","CIMC","Cottrell","Cozad","Delavan",
  "Doonan","Dorsey","Dragon","East Manufacturing","Fontaine","Great Dane","Heil","Hyundai",
  "Kalyn Siebert","Kentucky","Landoll","MAC Trailer","Manac","Other","Polar","Stoughton","Timpte",
  "Trail King","Utility","Vanguard","Viking","Wabash","Wilson"
];

export const DRIVER_TYPES = ["Owner-Operator", "Contract Driver", "Employee", "Team Driver"];
export const LICENSE_TYPES = ["Commercial", "Not Commercial"];
export const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const LAPSE_OPTIONS = ["None", "Within past 12 months", "12–24 months", "24–36 months"];

export const VIOLATION_TYPES = [
  "Speeding","Speeding 15+ Over","Speeding 20+ Over","Speeding 25+ Over","Speeding 30+ Over",
  "Speed Contest (Racing)","Driving Too Fast","Too Slow","Following Too Closely",
  "Failure to Obey Traffic Sign","Railroad Crossing","Failure to Signal",
  "Failure to Use Safety Belt","Failure to Yield","Failure to Show Insurance",
  "Improper Lane Change","Improper Passing","Improper Turn","Log Book Violation","Open Container",
  "Operating Under Influence (DUI/DWI)","Reckless Driving","Texting While Driving",
  "Cell Phone Use","Operating with Suspended License","Hit and Run","Other"
];

export const CANCELLATION_REASONS = [
  "Failure to Provide Documentation","Incurred Losses","Material Change in Risk",
  "Material Misrepresentation","Non-compliance with Binding Terms","Non-Payment of Premium","Other"
];

export const AUTO_LIABILITY_QUESTIONS = [
  { id: "q1", text: "Has the Applicant ever operated a trucking business under a different Authority or Name?", hasExplain: true },
  { id: "q2", text: "Does the Applicant operate as a Freight Forwarder, Freight Broker or arrange loads for others under the same MC/DOT Number?", hasExplain: false },
  { id: "q3", text: "Does the applicant haul double trailers and/or triple trailers?", hasExplain: true },
  { id: "q4", text: "Are all power units owned/operated by the applicant being scheduled on this policy?", hasExplain: false },
  { id: "q5", text: "Are team drivers or slip seating allowed?", hasExplain: true },
  { id: "q6", text: "Do you allow passengers other than company personnel?", hasExplain: true },
  { id: "q7", text: "Have any of the scheduled drivers been convicted of a felony?", hasExplain: true },
  { id: "q8", text: "Will there be any last mile or residential delivery exposure?", hasExplain: true },
  { id: "q9", text: "Has the applicant had 2 or more continuous years of commercial auto liability coverage?", hasExplain: true },
  { id: "q10", text: "Has the applicant had 2 or more continuous years of personal auto liability coverage?", hasExplain: false },
  { id: "q11", text: "Has the applicant ever filed for bankruptcy?", hasExplain: false, hasDate: true },
  { id: "q13", text: "Is the insured subject to an ELD mandate for Hours-of-Service compliance?", hasExplain: false },
  { id: "q14", text: "Do operations involve intermodal shipments or marine port terminals that require a UIIA Agreement?", hasExplain: false },
];

export const GL_QUESTIONS = [
  { id: "gl1", text: "Does the customer earn 100% of their income from for-hire trucking?" },
  { id: "gl2", text: "Any general liability losses in the last 36 months?" },
  { id: "gl3", text: "Does insured have a warehouse?" },
  { id: "gl4", text: "Does the insured own or operate any other business activities?" },
  { id: "gl5", text: "Does the insured have any permanently attached mobile equipment?" },
  { id: "gl6", text: "Is the insured involved in fracking, oil and gas, or tank farms?" },
  { id: "gl7", text: "Is the insured involved in any type of set-up or installation?" },
];

export const WIZARD_STEPS = [
  { id: 1, title: "Applicant Info", shortTitle: "Applicant" },
  { id: 2, title: "Coverage Requested", shortTitle: "Coverage" },
  { id: 3, title: "Radius & Operations", shortTitle: "Radius" },
  { id: 4, title: "Commodities", shortTitle: "Commodities" },
  { id: 5, title: "Power Units", shortTitle: "Trucks" },
  { id: 6, title: "Trailers", shortTitle: "Trailers" },
  { id: 7, title: "Drivers", shortTitle: "Drivers" },
  { id: 8, title: "Loss History", shortTitle: "Losses" },
  { id: 9, title: "General Questions", shortTitle: "Questions" },
  { id: 10, title: "Review & Submit", shortTitle: "Review" },
];
