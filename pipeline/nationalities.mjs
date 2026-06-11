// pipeline/nationalities.mjs
// Flags for match-lineup players (confident entries only; anything missing
// falls back to "⚽" in the app). CANON fixes raw gw display-name oddities.
// Proper nationality data for ALL players arrives with the Transfermarkt
// adapter (country_of_citizenship); this map covers the 24 featured matches.

export const CANON = {
  "Alisson": "Alisson Becker", "Virgil": "Virgil van Dijk", "Van Dijk": "Virgil van Dijk",
  "De Bruyne": "Kevin De Bruyne", "Darwin": "Darwin Núñez", "Thiago": "Thiago Alcântara",
  "Thomas": "Thomas Partey", "Enzo": "Enzo Fernández", "Bernardo": "Bernardo Silva",
  "de Gea": "David de Gea", "Sanchez": "Robert Sánchez", "Mac Allister": "Alexis Mac Allister",
  "Smith Rowe": "Emile Smith Rowe", "Bruno G.": "Bruno Guimarães", "Bruno Guimarães": "Bruno Guimarães",
  "Rodrigo": "Rodri", "Gabriel": "Gabriel Magalhães", "Ederson": "Ederson", "Fred": "Fred",
  "Fabinho": "Fabinho", "Fernandinho": "Fernandinho", "Joelinton": "Joelinton",
  "Emiliano Martínez": "Emiliano Martínez", "Trézéguet": "Trézéguet",
};

export const FLAGS = {
  "Aaron Ramsdale":"🏴","Aaron Wan-Bissaka":"🏴","Alexander Isak":"🇸🇪","Alisson Becker":"🇧🇷",
  "Allan Saint-Maximin":"🇫🇷","Andrew Robertson":"🏴","Anthony Gordon":"🏴","Anthony Martial":"🇫🇷",
  "Axel Disasi":"🇫🇷","Aymeric Laporte":"🇪🇸","Ben Davies":"🏴","Ben White":"🏴",
  "Benoît Badiashile":"🇫🇷","Bernardo Silva":"🇵🇹","Bruno Fernandes":"🇵🇹","Bruno Guimarães":"🇧🇷",
  "Bukayo Saka":"🏴","Callum Wilson":"🏴","Cody Gakpo":"🇳🇱","Cole Palmer":"🏴",
  "Conor Gallagher":"🏴","Cristian Romero":"🇦🇷","Curtis Jones":"🏴","Dan Burn":"🏴",
  "Daniel James":"🏴","Darwin Núñez":"🇺🇾","David Raya":"🇪🇸","David de Gea":"🇪🇸",
  "Davinson Sánchez":"🇨🇴","Declan Rice":"🏴","Dejan Kulusevski":"🇸🇪","Diogo Jota":"🇵🇹",
  "Dominik Szoboszlai":"🇭🇺","Douglas Luiz":"🇧🇷","Ederson":"🇧🇷","Edward Nketiah":"🏴",
  "Elliot Anderson":"🏴","Emerson Royal":"🇧🇷","Emiliano Martínez":"🇦🇷","Emile Smith Rowe":"🏴",
  "Enzo Fernández":"🇦🇷","Eric Dier":"🏴","Eric Garcia":"🇪🇸","Erik Lamela":"🇦🇷",
  "Erling Haaland":"🇳🇴","Ezri Konsa":"🏴","Fabian Schär":"🇨🇭","Fabinho":"🇧🇷",
  "Fernandinho":"🇧🇷","Ferran Torres":"🇪🇸","Fred":"🇧🇷","Gabriel Magalhães":"🇧🇷",
  "Gabriel Jesus":"🇧🇷","Gabriel Martinelli":"🇧🇷","Georginio Wijnaldum":"🇳🇱","Granit Xhaka":"🇨🇭",
  "Harry Kane":"🏴","Harry Maguire":"🏴","Harvey Elliott":"🏴","Heung-Min Son":"🇰🇷",
  "Hugo Lloris":"🇫🇷","Ibrahima Konaté":"🇫🇷","Ilkay Gündogan":"🇩🇪","Jack Grealish":"🏴",
  "Jacob Murphy":"🏴","Jadon Sancho":"🏴","Joe Gomez":"🏴","Joe Willock":"🏴",
  "Joelinton":"🇧🇷","John McGinn":"🏴","Jordan Henderson":"🏴","João Cancelo":"🇵🇹",
  "Jurriën Timber":"🇳🇱","Kai Havertz":"🇩🇪","Kevin De Bruyne":"🇧🇪","Kieran Trippier":"🏴",
  "Kyle Walker":"🏴","Leandro Trossard":"🇧🇪","Levi Colwill":"🏴","Lewis Hall":"🏴",
  "Lewis Miley":"🏴","Luis Díaz":"🇨🇴","Luke Shaw":"🏴","Alexis Mac Allister":"🇦🇷",
  "Malo Gusto":"🇫🇷","Manuel Akanji":"🇨🇭","Marc Cucurella":"🇪🇸","Marcus Rashford":"🏴",
  "Martin Dubravka":"🇸🇰","Martin Ødegaard":"🇳🇴","Matt Doherty":"🇮🇪","Matt Targett":"🏴",
  "Matthew Cash":"🇵🇱","Miguel Almirón":"🇵🇾","Mohamed Elneny":"🇪🇬","Mohamed Salah":"🇪🇬",
  "Moisés Caicedo":"🇪🇨","Moussa Sissoko":"🇫🇷","Mykhailo Mudryk":"🇺🇦","Myles Lewis-Skelly":"🏴",
  "Nathan Aké":"🇳🇱","Nathaniel Phillips":"🏴","Nick Pope":"🏴","Nicolas Jackson":"🇸🇳",
  "Noni Madueke":"🏴","Nuno Tavares":"🇵🇹","Oleksandr Zinchenko":"🇺🇦","Ollie Watkins":"🏴",
  "Pedro Neto":"🇵🇹","Phil Foden":"🏴","Pierre-Emile Højbjerg":"🇩🇰","Raheem Sterling":"🏴",
  "Reece James":"🏴","Rhys Williams":"🏴","Riyad Mahrez":"🇩🇿","Rob Holding":"🏴",
  "Robert Sánchez":"🇪🇸","Roberto Firmino":"🇧🇷","Rodri":"🇪🇸","Rodrigo Bentancur":"🇺🇾",
  "Ross Barkley":"🏴","Ryan Gravenberch":"🇳🇱","Rúben Dias":"🇵🇹","Sandro Tonali":"🇮🇹",
  "Scott Carson":"🏴","Scott McTominay":"🏴","Sean Longstaff":"🏴","Serge Aurier":"🇨🇮",
  "Sergio Gómez":"🇪🇸","Sergio Reguilón":"🇪🇸","Sven Botman":"🇳🇱","Tanguy Ndombele":"🇫🇷",
  "Thiago Alcântara":"🇪🇸","Thiago Silva":"🇧🇷","Thomas Partey":"🇬🇭","Tino Livramento":"🏴",
  "Trent Alexander-Arnold":"🏴","Trézéguet":"🇪🇬","Tyrone Mings":"🏴","Victor Lindelöf":"🇸🇪",
  "Wataru Endo":"🇯🇵","Wesley Fofana":"🇫🇷","William Saliba":"🇫🇷","Đorđe Petrović":"🇷🇸",
};
