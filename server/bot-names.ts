import _ from 'lodash';

const names = _.shuffle([
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
    'vencentio','verges','vincentio','viola'
]);

let index = 0;

export default function nextBotName(): string {
    const result = `~${names[index++]}~`;
    if (index >= names.length) {
        index = 0;
    }
    return result;
}

