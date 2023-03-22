import _ from 'lodash';

/**
 * Put them in a set first to eliminate duplicates, then shuffle them
 */

const names = _.shuffle(Array.from(new Set([

    /**
     * Shakespeare names from old 42
     */

    'abraham','adrian','adriana','adriano','aegeon','aemilia','alonso','amiens',
    'angelo','angus','antigonus','antipholus','antonio','ariel','arviragus',
    'audrey','balthazar','banquo','baptista','bardolph','barnardine','barnardo',
    'bassanio','beatrice','belarius','benedick','benvolio','bertram','bianca',
    'biondello','boyet','brabantio','caliban','camillo','caphis','cassio',
    'celia','ceres','christopher','claudio','claudius','cleomenes','cloten',
    'cordelia','corin','cornelius','costard','curan','curio','curtis','cymbeline',
    'demetrius','desdemona','diana','dion','dogberry','donalbain','dorcas',
    'dromio','dull','duncan','edgar','edmund','egeus','eglamour','elbow','emilia',
    'escalus','fabian','fenton','ferdinand','feste','flavius','fleance',
    'florizel','fortinbras','francisca','francisco','frederick','froth',
    'gertrude','goneril','gonzalo','gratiano','gregory','gremio','guiderius',
    'hamlet','hecate','helen','helena','hermia','hermione','hero','hippolyta',
    'holofernes','horatio','hortensio','hortensius','iago','imogen','iris',
    'isabella','jaquenetta','jaques','jessica','julia','juliet','juno',
    'katharina','katharine','laertes','lafeu','lancelot','launce','lavache',
    'lavinia','lennox','leonardo','leonato','leontes','lodovico','lorenzo',
    'luce','lucentio','lucetta','luciana','lucilius','lucio','lysander',
    'malcolm','malvolio','mamillius','marcellus','margaret','maria','mariana',
    'mercade','mercutio','miranda','montano','mopsa','moth','nathaniel','nell',
    'nerissa','nym','oberon','oliver','olivia','ophelia','orlando','orsino',
    'osric','oswald','othello','panthino','paris','parolles','paulina','perdita',
    'peter','petruchio','phebe','philario','philip','philostrate','phrynia',
    'pisanio','pistol','polixenes','polonius','pompey','portia','prospero',
    'proteus','regan','reynaldo','rinaldo','robin','roderigo','romeo','rosalind',
    'rosaline','ross','salerio','sampson','sebastian','seton','silvia','silvius',
    'simple','siward','snug','solanio','solinus','speed','stephano',
    'theseus','thurio','timandra','timon','titania','toby','touchstone','tranio',
    'trinculo','tubal','tybalt','ursula','valentine','varrius',
    'vencentio','verges','vincentio','viola',

    /**
     * 'Gothic names' ?
     */

    'agriwulf', 'aidoingus', 'ala', 'alatheus', 'alaviv', 'aligern',
    'amalaberga', 'amalafrida', 'amalaric', 'amalasuintha', 'ammius', 'andagis',
    'anogis', 'aoric', 'ardabur', 'ardaric', 'argaith', 'ariaric', 'arimir',
    'asbad', 'athaulf', 'aunulf', 'berimund', 'bessa', 'bigeis', 'brandila',
    'butilin', 'candac', 'cannabaudes', 'cniva', 'colias', 'colosseus',
    'dubius', 'duda', 'dulcilla', 'eberwulf', 'ebrimud', 'edica', 'eraric',
    'ereleuva', 'eriult', 'ermanaric', 'euric', 'eusebia', 'eutharic',
    'farnobius', 'fastida', 'frideric', 'fridibad', 'fritigern', 'fundobad',
    'gaatha', 'gainas', 'gaiseric', 'galindus', 'gento', 'gesalec', 'gesimund',
    'giso', 'godigisclus', 'goiaricus', 'gudeliva', 'gundiok', 'gunteric',
    'gutthikas', 'heribrand', 'herminafrid', 'hildebad', 'hilderith',
    'hildreic', 'himnerith', 'huneric', 'hunila', 'hunimund', 'lagariman',
    'leovigild', 'livila', 'matasuntha', 'mondares', 'munderic', 'mundo',
    'nidada', 'niketas', 'odoin', 'odotheus', 'odovacar', 'ostrogotho',
    'ovida', 'paulus', 'pelagia', 'procula', 'radagaisus', 'ragnahild',
    'ranilda', 'rausimod', 'recceswith', 'sidimund', 'sigeric', 'sigesar',
    'sindila', 'sisebut', 'sisenand', 'soas', 'suericus', 'sunigilda',
    'sunilda', 'teja', 'tharuaro', 'thela', 'theodahad', 'theroderid',
    'theudegisel', 'theudis', 'thiudimir', 'thiutigotho', 'thorismund',
    'thrasamund', 'totila', 'triarius', 'tribigild', 'tufa', 'tuldila',
    'tuluin', 'ulfilas', 'unila', 'valdamerca', 'valia', 'valkamir', 'vandil',
    'vedudco', 'videric', 'vidigoia', 'vidimir', 'visimar', 'vithimiris',
    'vitigis', 'wamba', 'winguric',

    /**
     * What we do in the shadows
     */

    'nandor', 'laslo', 'guillermo', 'nadja'
])));

let index = 0;

export default function nextBotName(): string {
    const result = `~${names[index++]}~`;
    if (index >= names.length) {
        index = 0;
    }
    return result;
}
