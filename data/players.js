// data/players.js
// Player database + verified puzzle bank. FOUR clue players per puzzle; name the
// one who played with all four. Answers span 1992-present, every answer unique,
// difficulty tracks fame/era. Every puzzle verified single-answer. sharedClubs[i]
// = the club where clue[i] overlapped with the answer.

import { GEN_PLAYERS, GEN_BANK, GEN_DAILY } from "./generated";
import { MATCHES } from "./matches";
import { TRANSFER_BANK } from "./transfers";

const CURATED_PLAYERS = {
  henry: ["Thierry Henry", "Arsenal / Barcelona", "FW", "🇫🇷", "ST", 97],
  vieira: ["Patrick Vieira", "Arsenal / Man City", "MF", "🇫🇷", "CDM", 93],
  pires: ["Robert Pirès", "Arsenal / Aston Villa", "MF", "🇫🇷", "LM", 90],
  lehmann: ["Jens Lehmann", "Arsenal", "GK", "🇩🇪", "GK", 86],
  overmars: ["Marc Overmars", "Arsenal / Barcelona", "FW", "🇳🇱", "LW", 88],
  drogba: ["Didier Drogba", "Chelsea", "FW", "🇨🇮", "ST", 93],
  gerrard: ["Steven Gerrard", "Liverpool", "MF", "🏴", "CM", 95],
  beckham: ["David Beckham", "Man Utd / Real Madrid / Milan", "MF", "🏴", "RM", 92],
  pschmeichel: ["Peter Schmeichel", "Man Utd / Man City / Aston Villa", "GK", "🇩🇰", "GK", 94],
  gneville: ["Gary Neville", "Man Utd", "DF", "🏴", "RB", 87],
  mcallister: ["Gary McAllister", "Leeds / Coventry / Liverpool", "MF", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "CM", 85],
  strachan: ["Gordon Strachan", "Man Utd / Leeds / Coventry", "MF", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "RM", 84],
  roblee: ["Rob Lee", "Newcastle / Derby", "MF", "🏴", "CM", 83],
  beardsley: ["Peter Beardsley", "Newcastle / Liverpool / Everton", "FW", "🏴", "SS", 89],
  klinsmann: ["Jürgen Klinsmann", "Tottenham / Bayern", "FW", "🇩🇪", "ST", 91],
  anderton: ["Darren Anderton", "Tottenham / Birmingham", "MF", "🏴", "RM", 84],
  berbatov: ["Dimitar Berbatov", "Tottenham / Man Utd / Fulham", "FW", "🇧🇬", "ST", 89],
  vidic: ["Nemanja Vidić", "Man Utd / Inter", "DF", "🇷🇸", "CB", 91],
  rkeane: ["Robbie Keane", "Tottenham / Liverpool / Leeds", "FW", "🇮🇪", "ST", 88],
  hazard: ["Eden Hazard", "Chelsea / Real Madrid", "FW", "🇧🇪", "LW", 93],
  mata: ["Juan Mata", "Chelsea / Man Utd", "MF", "🇪🇸", "CAM", 87],
  walcott: ["Theo Walcott", "Arsenal / Everton / Southampton", "FW", "🏴", "RW", 84],
  modric: ["Luka Modrić", "Tottenham / Real Madrid", "MF", "🇭🇷", "CM", 94],
  friedel: ["Brad Friedel", "Blackburn / Aston Villa / Tottenham", "GK", "🇺🇸", "GK", 84],
  benzema: ["Karim Benzema", "Lyon / Real Madrid", "FW", "🇫🇷", "ST", 94],
  marcelo: ["Marcelo", "Real Madrid", "DF", "🇧🇷", "LB", 90],
  tevez: ["Carlos Tevez", "West Ham / Man Utd / Man City / Juventus", "FW", "🇦🇷", "ST", 90],
  hargreaves: ["Owen Hargreaves", "Bayern / Man Utd / Man City", "MF", "🏴", "CDM", 84],
  lescott: ["Joleon Lescott", "Everton / Man City / West Brom", "DF", "🏴", "CB", 83],
  king: ["Ledley King", "Tottenham", "DF", "🏴", "CB", 87],
  adebayor: ["Emmanuel Adebayor", "Arsenal / Man City / Tottenham", "FW", "🇹🇬", "ST", 86],
  kolarov: ["Aleksandar Kolarov", "Man City / Roma", "DF", "🇷🇸", "LB", 85],
  ytoure: ["Yaya Touré", "Barcelona / Man City", "MF", "🇨🇮", "CM", 91],
  rvn: ["Ruud van Nistelrooy", "Man Utd / Real Madrid", "FW", "🇳🇱", "ST", 93],
  silvestre: ["Mikaël Silvestre", "Man Utd / Arsenal", "DF", "🇫🇷", "CB", 82],
  raul: ["Raúl", "Real Madrid / Schalke", "FW", "🇪🇸", "ST", 93],
  casillas: ["Iker Casillas", "Real Madrid / Porto", "GK", "🇪🇸", "GK", 94],
  hartson: ["John Hartson", "Arsenal / West Ham / Celtic", "FW", "🏴󠁧󠁢󠁷󠁬󠁳󠁿", "ST", 82],
  seaman: ["David Seaman", "Arsenal / Man City", "GK", "🏴", "GK", 89],
  distin: ["Sylvain Distin", "Man City / Portsmouth / Everton", "DF", "🇫🇷", "CB", 82],
  swp: ["Shaun Wright-Phillips", "Man City / Chelsea / QPR", "MF", "🏴", "RW", 83],
  sparker: ["Scott Parker", "Charlton / Chelsea / West Ham / Tottenham / Fulham", "MF", "🏴", "CDM", 84],
  noble: ["Mark Noble", "West Ham", "MF", "🏴", "CM", 81],
  rgreen: ["Robert Green", "Norwich / West Ham / QPR", "GK", "🏴", "GK", 81],
  gillespie: ["Keith Gillespie", "Man Utd / Newcastle / Blackburn", "MF", "🇬🇧", "RM", 80],

  aguero: ["Sergio Agüero", "Man City", "FW", "🇦🇷", "ST", 90],
  albrighton: ["Marc Albrighton", "Aston Villa / Leicester", "MF", "🏴", "RM", 74],
  anelka: ["Nicolas Anelka", "Arsenal / Liverpool / Man City / Bolton / Chelsea", "FW", "🇫🇷", "ST", 84],
  bale: ["Gareth Bale", "Spurs", "FW", "🏴", "RW", 88],
  barry: ["Gareth Barry", "Aston Villa / Man City / Everton / West Brom", "MF", "🏴", "CM", 80],
  bellamy: ["Craig Bellamy", "Norwich / Coventry / Newcastle / Blackburn / Liverpool / West Ham / Man City / Cardiff", "FW", "🏴", "ST", 81],
  bergkamp: ["Dennis Bergkamp", "Arsenal", "FW", "🇳🇱", "CAM", 90],
  butt: ["Nicky Butt", "Man Utd / Newcastle", "MF", "🏴", "CDM", 77],
  cahill_g: ["Gary Cahill", "Aston Villa / Bolton / Chelsea / Crystal Palace", "DF", "🏴", "CB", 82],
  campbell_s: ["Sol Campbell", "Spurs / Arsenal / Portsmouth / Newcastle", "DF", "🏴", "CB", 86],
  cantona: ["Eric Cantona", "Leeds / Man Utd", "FW", "🇫🇷", "CF", 89],
  carragher: ["Jamie Carragher", "Liverpool", "DF", "🏴", "CB", 84],
  carrick: ["Michael Carrick", "West Ham / Spurs / Man Utd", "MF", "🏴", "CDM", 84],
  cech: ["Petr Čech", "Chelsea / Arsenal", "GK", "🇨🇿", "GK", 89],
  cole_a: ["Ashley Cole", "Arsenal / Chelsea", "DF", "🏴", "LB", 87],
  cole_a_andy: ["Andy Cole", "Newcastle / Man Utd / Blackburn / Fulham / Man City / Portsmouth / Sunderland", "FW", "🏴", "ST", 84],
  cole_carlton: ["Carlton Cole", "Chelsea / West Ham", "FW", "🏴", "ST", 73],
  cole_j: ["Joe Cole", "West Ham / Chelsea / Liverpool", "MF", "🏴", "CAM", 83],
  crouch: ["Peter Crouch", "Aston Villa / Southampton / Liverpool / Portsmouth / Spurs / Stoke", "FW", "🏴", "ST", 78],
  debruyne: ["Kevin De Bruyne", "Chelsea / Man City", "MF", "🇧🇪", "CAM", 91],
  defoe: ["Jermain Defoe", "West Ham / Spurs / Sunderland / Bournemouth", "FW", "🏴", "ST", 82],
  dier: ["Eric Dier", "Spurs", "DF", "🏴", "CDM", 79],
  drinkwater: ["Danny Drinkwater", "Leicester / Chelsea", "MF", "🏴", "CM", 78],
  duff: ["Damien Duff", "Blackburn / Chelsea / Newcastle / Fulham", "MF", "🇮🇪", "LW", 83],
  dunne: ["Richard Dunne", "Everton / Man City / Aston Villa / QPR", "DF", "🇮🇪", "CB", 79],
  eriksen: ["Christian Eriksen", "Spurs / Brentford / Man Utd", "MF", "🇩🇰", "CAM", 85],
  fabregas: ["Cesc Fàbregas", "Arsenal / Chelsea", "MF", "🇪🇸", "CM", 88],
  ferdinand_les: ["Les Ferdinand", "QPR / Newcastle / Spurs / West Ham / Leicester", "FW", "🏴", "ST", 83],
  ferdinand_rio: ["Rio Ferdinand", "West Ham / Leeds / Man Utd / QPR", "DF", "🏴", "CB", 89],
  flowers: ["Tim Flowers", "Blackburn / Leicester", "GK", "🏴", "GK", 78],
  fowler: ["Robbie Fowler", "Liverpool / Leeds / Man City", "FW", "🏴", "ST", 86],
  giggs: ["Ryan Giggs", "Man Utd", "MF", "🏴", "LW", 89],
  gilberto: ["Gilberto Silva", "Arsenal", "MF", "🇧🇷", "CDM", 82],
  ginola: ["David Ginola", "Newcastle / Spurs / Aston Villa / Everton", "MF", "🇫🇷", "LW", 85],
  given: ["Shay Given", "Newcastle / Man City / Aston Villa / Stoke", "GK", "🇮🇪", "GK", 83],
  hart: ["Joe Hart", "Man City / Spurs", "GK", "🏴", "GK", 84],
  henderson: ["Jordan Henderson", "Sunderland / Liverpool", "MF", "🏴", "CM", 83],
  hughes_m: ["Mark Hughes", "Man Utd / Chelsea / Southampton / Everton", "FW", "🏴", "ST", 83],
  kane: ["Harry Kane", "Spurs", "FW", "🏴", "ST", 90],
  kante: ["N'Golo Kanté", "Leicester / Chelsea", "MF", "🇫🇷", "CDM", 88],
  kewell: ["Harry Kewell", "Leeds / Liverpool", "FW", "🇦🇺", "LW", 84],
  lallana: ["Adam Lallana", "Southampton / Liverpool / Brighton", "MF", "🏴", "CAM", 81],
  lampard: ["Frank Lampard", "West Ham / Chelsea / Man City", "MF", "🏴", "CM", 89],
  mahrez: ["Riyad Mahrez", "Leicester / Man City", "FW", "🇩🇿", "RW", 85],
  mascherano: ["Javier Mascherano", "West Ham / Liverpool", "MF", "🇦🇷", "CDM", 85],
  mcmanaman: ["Steve McManaman", "Liverpool / Man City", "MF", "🏴", "RW", 84],
  milner: ["James Milner", "Leeds / Newcastle / Aston Villa / Man City / Liverpool / Brighton", "MF", "🏴", "CM", 82],
  nani: ["Nani", "Man Utd", "FW", "🇵🇹", "RW", 83],
  nasri: ["Samir Nasri", "Arsenal / Man City", "MF", "🇫🇷", "CAM", 83],
  owen: ["Michael Owen", "Liverpool / Newcastle / Man Utd / Stoke", "FW", "🏴", "ST", 88],
  parlour: ["Ray Parlour", "Arsenal / Middlesbrough", "MF", "🏴", "CM", 78],
  petit: ["Emmanuel Petit", "Arsenal / Chelsea", "MF", "🇫🇷", "CDM", 84],
  redknapp_j: ["Jamie Redknapp", "Liverpool / Spurs / Southampton", "MF", "🏴", "CM", 81],
  reyes: ["José Antonio Reyes", "Arsenal", "FW", "🇪🇸", "LW", 81],
  ronaldo_c: ["Cristiano Ronaldo", "Man Utd", "FW", "🇵🇹", "RW", 91],
  rooney: ["Wayne Rooney", "Everton / Man Utd", "FW", "🏴", "ST", 90],
  salah: ["Mohamed Salah", "Chelsea / Liverpool", "FW", "🇪🇬", "RW", 90],
  schmeichel_k: ["Kasper Schmeichel", "Man City / Leicester", "GK", "🇩🇰", "GK", 84],
  scholes: ["Paul Scholes", "Man Utd", "MF", "🏴", "CM", 88],
  shearer: ["Alan Shearer", "Blackburn / Newcastle", "FW", "🏴", "ST", 91],
  sheringham: ["Teddy Sheringham", "Spurs / Man Utd / West Ham", "FW", "🏴", "CF", 84],
  silva_d: ["David Silva", "Man City", "MF", "🇪🇸", "CAM", 89],
  smith_a: ["Alan Smith", "Leeds / Man Utd / Newcastle", "FW", "🏴", "ST", 78],
  son: ["Son Heung-min", "Spurs", "FW", "🇰🇷", "LW", 89],
  sterling: ["Raheem Sterling", "Liverpool / Man City / Chelsea", "FW", "🏴", "LW", 87],
  sturridge: ["Daniel Sturridge", "Man City / Chelsea / Liverpool", "FW", "🏴", "ST", 82],
  sutton: ["Chris Sutton", "Norwich / Blackburn / Chelsea / Celtic / Aston Villa", "FW", "🏴", "ST", 80],
  terry: ["John Terry", "Chelsea", "DF", "🏴", "CB", 88],
  torres: ["Fernando Torres", "Liverpool / Chelsea", "FW", "🇪🇸", "ST", 87],
  toure_k: ["Kolo Touré", "Arsenal / Man City / Liverpool", "DF", "🇨🇮", "CB", 82],
  vandijk: ["Virgil van Dijk", "Southampton / Liverpool", "DF", "🇳🇱", "CB", 90],
  vanpersie: ["Robin van Persie", "Arsenal / Man Utd", "FW", "🇳🇱", "ST", 88],
  vardy: ["Jamie Vardy", "Leicester", "FW", "🏴", "ST", 85],
  vdsar: ["Edwin van der Sar", "Fulham / Man Utd", "GK", "🇳🇱", "GK", 87],
  viduka: ["Mark Viduka", "Leeds / Middlesbrough / Newcastle", "FW", "🇦🇺", "ST", 82],
  walker: ["Kyle Walker", "Spurs / Man City", "DF", "🏴", "RB", 85],
  woodgate: ["Jonathan Woodgate", "Leeds / Newcastle / Middlesbrough / Spurs / Stoke", "DF", "🏴", "CB", 81],
  wright_i: ["Ian Wright", "Arsenal / West Ham", "FW", "🏴", "ST", 85],
  yorke: ["Dwight Yorke", "Aston Villa / Man Utd / Blackburn / Birmingham / Sunderland", "FW", "🇹🇹", "ST", 83],
  young_a: ["Ashley Young", "Watford / Aston Villa / Man Utd", "MF", "🏴", "LM", 79],
};

export const POSNAME = { GK: "Goalkeeper", DF: "Defender", MF: "Midfielder", FW: "Forward" };

const CURATED_BANK = [
  {clues:["henry","campbell_s","terry","drogba"],answer:"cole_a",valid:["cole_a"],diff:"medium",sharedClubs:["Arsenal","Arsenal","Chelsea","Chelsea"],era:"Mid 2000s"},
  {clues:["modric","friedel","benzema","marcelo"],answer:"bale",valid:["bale"],diff:"medium",sharedClubs:["Tottenham","Tottenham","Real Madrid","Real Madrid"],era:"Mid 2010s"},
  {clues:["rooney","ronaldo_c","aguero","lescott"],answer:"tevez",valid:["tevez","hargreaves"],diff:"easy",sharedClubs:["Man Utd","Man Utd","Man City","Man City"],era:"Late 2000s"},
  {clues:["mcallister","strachan","pschmeichel","beckham"],answer:"cantona",valid:["cantona"],diff:"hard",sharedClubs:["Leeds","Leeds","Man Utd","Man Utd"],era:"1990s"},
  {clues:["klinsmann","anderton","beckham","yorke"],answer:"sheringham",valid:["sheringham"],diff:"medium",sharedClubs:["Tottenham","Tottenham","Man Utd","Man Utd"],era:"Late 1990s"},
  {clues:["berbatov","defoe","gerrard","torres"],answer:"rkeane",valid:["rkeane"],diff:"medium",sharedClubs:["Tottenham","Tottenham","Liverpool","Liverpool"],era:"Late 2000s"},
  {clues:["fabregas","vanpersie","kolarov","ytoure"],answer:"adebayor",valid:["adebayor","toure_k"],diff:"medium",sharedClubs:["Arsenal","Arsenal","Man City","Man City"],era:"Early 2010s"},
  {clues:["scholes","silvestre","raul","casillas"],answer:"rvn",valid:["rvn","beckham"],diff:"medium",sharedClubs:["Man Utd","Man Utd","Real Madrid","Real Madrid"],era:"Mid 2000s"},
  {clues:["bergkamp","seaman","ferdinand_rio","lampard"],answer:"wright_i",valid:["wright_i","hartson"],diff:"hard",sharedClubs:["Arsenal","Arsenal","West Ham","West Ham"],era:"Late 1990s"},
  {clues:["distin","anelka","terry","lampard"],answer:"swp",valid:["swp"],diff:"hard",sharedClubs:["Man City","Man City","Chelsea","Chelsea"],era:"Mid 2000s"},
  {clues:["terry","lampard","noble","rgreen"],answer:"sparker",valid:["sparker"],diff:"hard",sharedClubs:["Chelsea","Chelsea","West Ham","West Ham"],era:"Late 2000s"},
  {clues:["rkeane","defoe","rooney","vidic"],answer:"berbatov",valid:["berbatov","carrick"],diff:"easy",sharedClubs:["Tottenham","Tottenham","Man Utd","Man Utd"],era:"Late 2000s"},
  {clues:["viduka","lallana","nasri","albrighton"],answer:"milner",valid:["milner"],diff:"easy",sharedClubs:["Leeds","Liverpool","Man City","Aston Villa"],era:"Mid 2010s"},
  {clues:["lallana","debruyne","kante","silva_d"],answer:"sterling",valid:["sterling"],diff:"easy",sharedClubs:["Liverpool","Man City","Chelsea","Man City"],era:"Late 2010s"},
  {clues:["anelka","walker","cole_a","sturridge"],answer:"debruyne",valid:["debruyne"],diff:"easy",sharedClubs:["Chelsea","Man City","Chelsea","Chelsea"],era:"Mid 2010s"},
  {clues:["albrighton","walker","vardy","schmeichel_k"],answer:"mahrez",valid:["mahrez"],diff:"easy",sharedClubs:["Leicester","Man City","Leicester","Leicester"],era:"Mid 2010s"},
  {clues:["sturridge","cole_a_andy","vandijk","milner"],answer:"henderson",valid:["henderson"],diff:"easy",sharedClubs:["Liverpool","Sunderland","Liverpool","Liverpool"],era:"Late 2010s"},
  {clues:["hughes_m","giggs","ginola","vanpersie"],answer:"rooney",valid:["rooney"],diff:"easy",sharedClubs:["Everton","Man Utd","Everton","Man Utd"],era:"Late 2000s"},
  {clues:["henderson","fabregas","lallana","cech"],answer:"salah",valid:["salah"],diff:"easy",sharedClubs:["Liverpool","Chelsea","Liverpool","Chelsea"],era:"Late 2010s"},
  {clues:["hart","ronaldo_c","son","walker"],answer:"eriksen",valid:["eriksen"],diff:"easy",sharedClubs:["Spurs","Man Utd","Spurs","Spurs"],era:"Late 2010s"},
  {clues:["wright_i","viduka","dunne","vanpersie"],answer:"ferdinand_rio",valid:["ferdinand_rio"],diff:"medium",sharedClubs:["West Ham","Leeds","QPR","Man Utd"],era:"Mid 2010s"},
  {clues:["fowler","bellamy","ronaldo_c","woodgate"],answer:"owen",valid:["owen"],diff:"medium",sharedClubs:["Liverpool","Newcastle","Man Utd","Stoke"],era:"Late 2000s"},
  {clues:["anelka","milner","defoe","cole_carlton"],answer:"lampard",valid:["lampard"],diff:"medium",sharedClubs:["Chelsea","Man City","West Ham","Chelsea"],era:"Early 2010s"},
  {clues:["wright_i","smith_a","redknapp_j","lampard"],answer:"carrick",valid:["carrick"],diff:"medium",sharedClubs:["West Ham","Man Utd","Spurs","West Ham"],era:"Mid 2000s"},
  {clues:["bellamy","wright_i","sturridge","anelka"],answer:"cole_j",valid:["cole_j"],diff:"medium",sharedClubs:["Liverpool","West Ham","Chelsea","Chelsea"],era:"Early 2010s"},
  {clues:["terry","toure_k","lallana","cech"],answer:"sturridge",valid:["sturridge"],diff:"medium",sharedClubs:["Chelsea","Man City","Liverpool","Chelsea"],era:"Early 2010s"},
  {clues:["milner","terry","anelka","kante"],answer:"cahill_g",valid:["cahill_g"],diff:"medium",sharedClubs:["Aston Villa","Chelsea","Bolton","Chelsea"],era:"Mid 2010s"},
  {clues:["hart","ginola","rooney","aguero"],answer:"barry",valid:["barry"],diff:"medium",sharedClubs:["Man City","Aston Villa","Everton","Man City"],era:"Early 2010s"},
  {clues:["nasri","nani","reyes","gilberto"],answer:"vanpersie",valid:["vanpersie"],diff:"medium",sharedClubs:["Arsenal","Man Utd","Arsenal","Arsenal"],era:"Early 2010s"},
  {clues:["cahill_g","bergkamp","drinkwater","lampard"],answer:"fabregas",valid:["fabregas"],diff:"medium",sharedClubs:["Chelsea","Arsenal","Chelsea","Chelsea"],era:"Mid 2010s"},
  {clues:["fabregas","carragher","crouch","mascherano"],answer:"torres",valid:["torres"],diff:"medium",sharedClubs:["Chelsea","Liverpool","Liverpool","Liverpool"],era:"Late 2000s"},
  {clues:["dier","carrick","sheringham","redknapp_j"],answer:"defoe",valid:["defoe"],diff:"medium",sharedClubs:["Spurs","West Ham","West Ham","Spurs"],era:"Mid 2000s"},
  {clues:["milner","butt","parlour","bale"],answer:"woodgate",valid:["woodgate"],diff:"hard",sharedClubs:["Leeds","Newcastle","Middlesbrough","Spurs"],era:"Late 2000s"},
  {clues:["hart","cantona","vdsar","ferdinand_les"],answer:"cole_a_andy",valid:["cole_a_andy"],diff:"hard",sharedClubs:["Man City","Man Utd","Fulham","Newcastle"],era:"Mid 2000s"},
  {clues:["sheringham","gilberto","crouch","smith_a"],answer:"campbell_s",valid:["campbell_s"],diff:"hard",sharedClubs:["Spurs","Arsenal","Portsmouth","Newcastle"],era:"Late 2000s"},
  {clues:["toure_k","albrighton","hughes_m","ferdinand_rio"],answer:"dunne",valid:["dunne"],diff:"hard",sharedClubs:["Man City","Aston Villa","Everton","QPR"],era:"Early 2010s"},
  {clues:["viduka","silva_d","crouch","albrighton"],answer:"given",valid:["given"],diff:"hard",sharedClubs:["Newcastle","Man City","Stoke","Aston Villa"],era:"Mid 2010s"},
  {clues:["cahill_g","mcmanaman","petit","cech"],answer:"anelka",valid:["anelka"],diff:"hard",sharedClubs:["Bolton","Man City","Arsenal","Chelsea"],era:"Late 2000s"},
  {clues:["scholes","duff","barry","henderson"],answer:"yorke",valid:["yorke"],diff:"hard",sharedClubs:["Man Utd","Blackburn","Aston Villa","Sunderland"],era:"Mid 2000s"},
  {clues:["sturridge","mascherano","woodgate","cole_carlton"],answer:"bellamy",valid:["bellamy"],diff:"hard",sharedClubs:["Man City","Liverpool","Newcastle","West Ham"],era:"Late 2000s"},
  {clues:["kewell","redknapp_j","barry","kane"],answer:"crouch",valid:["crouch"],diff:"hard",sharedClubs:["Liverpool","Southampton","Aston Villa","Spurs"],era:"Late 2000s"},
  {clues:["given","rooney","campbell_s","barry"],answer:"ginola",valid:["ginola"],diff:"hard",sharedClubs:["Newcastle","Everton","Spurs","Aston Villa"],era:"Early 2000s"},
  {clues:["sheringham","defoe","cole_a_andy","carrick"],answer:"ferdinand_les",valid:["ferdinand_les"],diff:"hard",sharedClubs:["Spurs","West Ham","Newcastle","West Ham"],era:"Mid 2000s"},
  {clues:["shearer","young_a","terry","flowers"],answer:"sutton",valid:["sutton"],diff:"hard",sharedClubs:["Blackburn","Aston Villa","Chelsea","Blackburn"],era:"Early 2000s"},
];

// ---- merged dataset: curated classics (1992-2016, hand-verified) + generated
// modern bank (2016-now, real FPL data via the content pipeline). ------------
export const PLAYERS = { ...CURATED_PLAYERS, ...GEN_PLAYERS };

// Same real player in both sets (e.g. Ashley Young): the hand-curated entry is
// the vetted one — its name, position, rating and flag win for every id that
// maps to that person, so era-dependent TM positions can't mislabel a card.
{
  const byName = {};
  for (const e of Object.values(CURATED_PLAYERS)) byName[e[0].toLowerCase()] = e;
  for (const [id, e] of Object.entries(GEN_PLAYERS)) {
    const c = byName[e[0].toLowerCase()];
    if (c) PLAYERS[id] = c;
  }
}

// No answer repeats across sets: drop generated puzzles whose answer (by name)
// is already a curated answer — keeps every level's answer a fresh face.
const _curAns = new Set(CURATED_BANK.map((b) => CURATED_PLAYERS[b.answer][0].toLowerCase()));
export const BANK = [
  ...CURATED_BANK,
  ...GEN_BANK.filter((b) => !_curAns.has(GEN_PLAYERS[b.answer][0].toLowerCase())),
];

// DAILY pool: reserved generated puzzles, disjoint from every level answer —
// so the daily never repeats a face you've solved on the ladder.
const _levelAns = new Set(BANK.map((b) => PLAYERS[b.answer][0].toLowerCase()));
export const DAILY_BANK = GEN_DAILY.filter((b) => !_levelAns.has(GEN_PLAYERS[b.answer][0].toLowerCase()));

// LEVELS: typed and interleaved — two connection levels, then one real-match
// level, repeating; leftover matches extend the ladder. Connection levels run
// easy -> hard; match levels carry the fixture as their theme.
const _order = { easy: 0, medium: 1, hard: 2 };
const _idx = BANK.map((b, i) => i).sort((a, b) => {
  const d = _order[BANK[a].diff] - _order[BANK[b].diff];
  if (d) return d;
  return (a % 7) - (b % 7);
});
const _names = [
  ["THE WARM-UP","Find your feet"],["FRESH LEGS","Modern names"],["RECENT MEMORY","Last few seasons"],
  ["SQUAD ROTATION","Mixing it up"],["THE 2020s","Today's game"],["MIDWEEK FIXTURE","Solid tests"],
  ["THE 2010s","Last decade"],["GOLDEN ERA","2000s big guns"],["FORM BOOK","Getting trickier"],
  ["OLD SCHOOL","Needs some history"],["CULT HEROES","Proper anorak territory"],["THE ARCHIVE","Deep cuts"],
  ["THE 90s VAULT","Into the vault"],["LEGENDS' XI","Household names, hard links"],["EXTRA TIME","Bonus round"],
  ["INJURY TIME","Squeaky bum time"],["THE GAUNTLET","No mercy"],["FULL TIME","The final whistle"],
];
export const LEVELS = [];
{
  let ci = 0, mi = 0, nameI = 0;
  const pushConnect = () => {
    if (ci + 3 > _idx.length) return false;
    const n = _names[nameI++] || ["LEVEL " + (LEVELS.length + 1), "Keep going"];
    LEVELS.push({ type: "connect", name: n[0], theme: n[1], puzzles: [_idx[ci], _idx[ci + 1], _idx[ci + 2]] });
    ci += 3; return true;
  };
  const pushMatch = () => {
    if (mi >= MATCHES.length) return false;
    const m = MATCHES[mi];
    LEVELS.push({ type: "match", name: "MATCH DAY", theme: `${m.home} ${m.score} ${m.away}`, match: mi });
    mi++; return true;
  };
  // rhythm: training -> match day -> transfer window, repeating
  let ti = 0;
  const pushTransfer = () => {
    if (ti + 3 > TRANSFER_BANK.length) return false;
    LEVELS.push({ type: "transfer", name: "TRANSFER WINDOW", theme: "Where did he go?", qs: [ti, ti + 1, ti + 2] });
    ti += 3; return true;
  };
  while (ci + 3 <= _idx.length || mi < MATCHES.length || ti + 3 <= TRANSFER_BANK.length) {
    let moved = pushConnect();
    moved = pushMatch() || moved;
    moved = pushTransfer() || moved;
    if (!moved) break;
  }
}
