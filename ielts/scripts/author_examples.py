"""Original, authored reference materials. No commercial passage is reproduced."""
from pathlib import Path
import json, re
ROOT=Path(__file__).resolve().parents[1]
EX=[]
def add(stage,title,lexicon,collocations,reading,dialogue,rq,lq,speaking,writing,model,teacher_note):
    EX.append(dict(id=f'EX{stage:02}', lesson_id=f'L{(stage-1)*80+1:04}', stage=stage,title=title,
        provenance='Original Vocora-commissioned fictional teaching material; not an IELTS test or a certified band exemplar.',
        status='authored_reference_material_not_runtime_import',lexicon=lexicon,collocations=collocations,
        reading={'id':f'EX{stage:02}-R','text':reading.strip(),'word_count':len(re.findall(r"\b[\w]+(?:['’-][\w]+)*\b",reading))},
        listening={'id':f'EX{stage:02}-A','script':dialogue.strip(),'audio_available':False,'recording_status':'Requires recorded/QA audio; speaker labels are not spoken','use':'Formative teaching only; not a sealed readiness test'},
        reading_questions=[dict(id=f'EX{stage:02}-R{i+1:02}',type=t,prompt=q,answer=a,rationale=why) for i,(t,q,a,why) in enumerate(rq)],
        listening_questions=[dict(id=f'EX{stage:02}-A{i+1:02}',type=t,prompt=q,answer=a,rationale=why) for i,(t,q,a,why) in enumerate(lq)],
        speaking={'prompt':speaking,'delivery':'Record an independent answer first. Then review evidence-based feedback and record a fresh parallel response, not a memorised copy.','scoring':'Formative analytic feedback only until the evaluator is calibrated.'},
        writing={'prompt':writing,'model':model.strip(),'model_status':'Original illustration, not examiner-certified. Display only after the learner has submitted an independent attempt.','revision':'Locate one meaning/organisation problem and one language-control problem, revise, then transfer to a different prompt.'},
        teacher_note=teacher_note,source_ids=['I02','I03','I04','I05','I06','I07','R01','R03','R04','R06','R07']))
# tuple fields: target, part of speech, learner definition, original example
add(1,'Food: who eats what?',[
 ('bread','noun, normally uncountable in this meaning','a food made from flour and water and usually baked','I eat bread.'),
 ('rice','uncountable noun','small grains cooked and eaten as food','We eat rice.'),
 ('water','uncountable noun','the clear liquid people drink','I drink water.'),
 ('milk','uncountable noun','a white liquid used as a drink or food','We drink milk.'),
 ('eat','verb','to put food in your mouth and swallow it','I eat rice.'),
 ('drink','verb','to take liquid into your mouth and swallow it','You drink water.')],
 ['eat bread','eat rice','drink water'],
 """My name is Mina. I eat bread in the morning. I drink milk. My brother, Sam, eats rice at lunch. He drinks water. We eat at home. Our table is small. In the evening, I eat rice and Sam eats bread. We both drink water. We like our meals. On Sunday, our friend Jo eats with us at home.""",
 """Ari: Hello, Jo. What do you eat in the morning?
Jo: I eat rice.
Ari: Do you drink milk?
Jo: No. I drink water.
Ari: I eat bread and drink milk.
Jo: Do you eat at home?
Ari: Yes. My sister eats with me.
Jo: I eat with my brother. We sit at a small table.""",
 [('short-answer','What does Mina eat in the morning? Write ONE WORD.','bread','The second sentence states Mina eats bread in the morning.'),
 ('short-answer','What does Sam drink at lunch? Write ONE WORD.','water','He in the sentence after Sam refers to Sam.'),
 ('truth','Mina and Sam eat at home. TRUE, FALSE or NOT GIVEN?','TRUE','We eat at home explicitly states this.'),
 ('truth','Their table is large. TRUE, FALSE or NOT GIVEN?','FALSE','The text says the table is small.'),
 ('truth','Jo is twenty years old. TRUE, FALSE or NOT GIVEN?','NOT GIVEN','The text gives no age for Jo.'),
 ('classification','In I eat bread, identify the subject, verb and object.','I = subject; eat = verb; bread = object','The subject does the action, and bread names what is eaten.'),
 ('short-answer','Who eats with the family on Sunday? Write ONE WORD.','Jo','The last sentence identifies the visitor.'),
 ('short-answer','What do both Mina and Sam drink in the evening? Write ONE WORD.','water','We both drink water follows the evening meal description.')],
 [('short-answer','What does Jo eat in the morning? ONE WORD.','rice','Jo says I eat rice.'),
 ('short-answer','What does Jo drink? ONE WORD.','water','Jo rejects milk and states water.'),
 ('short-answer','What does Ari eat? ONE WORD.','bread','Ari explicitly says I eat bread.'),
 ('short-answer','What does Ari drink? ONE WORD.','milk','Ari says drink milk.'),
 ('choice','Who eats with Ari: his sister, his brother, or Jo?','his sister','Ari says My sister eats with me.'),
 ('choice','Who eats with Jo: her teacher, her brother, or Mina?','her brother','Jo names her brother.'),
 ('truth','Jo says she drinks milk. TRUE or FALSE?','FALSE','No rejects the suggested milk; water is the final answer.'),
 ('dictation','Listen to the isolated phrase from a separate word-audio cue and type it: drink water.','drink water','Exact word form and boundary, not a comprehension inference.')],
 'Say what you eat and drink in the morning. Use two or three complete statements. You may invent a meal. Do not read the model.',
 'Write 20–40 words about one meal. Say who eats, what they eat and what they drink. Use the six target words where relevant; do not force all of them.',
 'I eat bread in the morning. I drink water. My sister eats rice. She drinks milk. We eat at home, and we like our food.',
 'Teach I/you/we, the core SVO frame, and eat versus drink before the reading. Names, home, morning and table must be known from onboarding or glossed. Third-person forms in the passage are supported exposure, not an untaught compulsory production target. TRUE/FALSE/NOT GIVEN here is guided logic practice, not a timed IELTS test.')
add(2,'Shopping: quantities and the final order',[
 ('ingredient','count noun','one of the foods used to make a dish','Rice is one ingredient in this meal.'),
 ('vegetable','count noun','a plant or part of a plant eaten as food','We buy fresh vegetables.'),
 ('carrot','count noun','a long orange vegetable','We need two carrots.'),
 ('onion','count noun','a vegetable with layers and a strong taste','Chop one onion.'),
 ('pepper','count noun in this context','a red, green or yellow vegetable','Add a red pepper.'),
 ('cheese','normally uncountable noun','a food made from milk','We need some cheese.')],
 ['a kilo of rice','a bottle of oil','pay in cash'],
 """The neighbourhood cooking club meets on Saturday. This week, six people are making a vegetable meal. Leila has a shopping list. She needs one kilo of rice, four carrots, two onions and one red pepper. There is already some oil in the club kitchen, so she does not need to buy a bottle. The club also has salt. Leila wants some cheese for a small salad, but the shop does not have any today. She decides to make the salad without it. The vegetables cost eight pounds, and the rice costs three pounds. Leila pays eleven pounds in cash. She keeps the receipt. The club starts cooking at ten, but Leila arrives at half past nine to wash the vegetables. The club is next to the library. The notice does not give the library's opening time.""",
 """Shopkeeper: Good morning. What would you like?
Customer: Two kilos of rice, please. Sorry, just one kilo. There are only three of us today.
Shopkeeper: One kilo. Anything else?
Customer: Three onions and a bottle of oil.
Shopkeeper: The small bottle or the large one?
Customer: The small one, please. Do you have any carrots?
Shopkeeper: Yes. They are two pounds a kilo.
Customer: I'll take one kilo of carrots as well.
Shopkeeper: That is nine pounds in total.
Customer: Can I pay by card?
Shopkeeper: I'm sorry, the machine is not working.
Customer: That's all right. I'll pay in cash. Could I have a receipt?
Shopkeeper: Of course. Here you are.""",
 [('short-answer','How many people are cooking on Saturday? ONE WORD OR A NUMBER.','six / 6','The second sentence gives six.'),
 ('short-answer','How many onions are on Leila\'s list? ONE WORD OR A NUMBER.','two / 2','The list says two onions.'),
 ('truth','Leila buys some oil. TRUE, FALSE or NOT GIVEN?','FALSE','Oil is already available, so she does not buy it.'),
 ('truth','The shop has cheese today. TRUE, FALSE or NOT GIVEN?','FALSE','It does not have any today.'),
 ('short-answer','What is the total cost in pounds? ONE WORD OR A NUMBER.','eleven / 11','Eight for vegetables plus three for rice equals eleven.'),
 ('short-answer','At what time does Leila arrive? Write a time.','9:30 / half past nine','Arrival is earlier than the ten o\'clock cooking start.'),
 ('truth','The library opens at nine. TRUE, FALSE or NOT GIVEN?','NOT GIVEN','The text explicitly says the opening time is not given.'),
 ('error-correction','Correct only the quantity question: How many rice does Leila buy?','How much rice does Leila buy?','Rice is uncountable here; kilos would be countable.')],
 [('short-answer','Final rice order, in kilos: ONE WORD OR A NUMBER.','one / 1','Two is explicitly corrected to one.'),
 ('short-answer','Number of onions: ONE WORD OR A NUMBER.','three / 3','The customer orders three onions.'),
 ('short-answer','Oil bottle size: ONE WORD.','small','The customer chooses the small bottle.'),
 ('short-answer','Carrots cost ___ pounds a kilo. ONE WORD OR A NUMBER.','two / 2','This is the unit price, not the total purchase price.'),
 ('short-answer','Total cost: ___ pounds. ONE WORD OR A NUMBER.','nine / 9','The shopkeeper states the total.'),
 ('choice','How does the customer finally pay: card, cash, or online transfer?','cash','Card is requested but unavailable; cash is the final method.'),
 ('short-answer','What document does the customer request? ONE WORD.','receipt','Could I have a receipt? provides the exact word.'),
 ('choice','Why is the rice order reduced: fewer people, a higher price, or no rice in stock?','fewer people','The customer says there are only three people today.')],
 'Role-play a shop order. Ask for two ingredients, specify a quantity, then politely correct one part of your order. Answer a follow-up about payment.',
 'Write 40–65 words explaining what you need for a simple meal and what you already have. Use some/any and one countable quantity.',
 'We are making a vegetable meal for three people. We need one kilo of rice, two onions and some carrots. We already have some oil, so we do not need another bottle. There is not any cheese in the kitchen, but we can make the meal without it.',
 'The teaching passage and listening order use different people, quantities and final decisions. For a test, hide the script and do not reveal the corrected order beforehand. A synthetic dialogue is acceptable for formative rehearsal only; a readiness task needs natural, quality-controlled audio.')
add(3,'Cooking: reconstructing a sequence',[
 ('recipe','count noun','instructions for making a particular dish','We followed a simple recipe.'),
 ('portion','count noun','an amount of food for one person','The recipe makes four portions.'),
 ('slice','count noun','a thin flat piece cut from something','She cut a slice of bread.'),
 ('piece','count noun','a part separated from a whole','Add a small piece of cheese.'),
 ('bowl','count noun','a round container for food','Put the salad in a bowl.'),
 ('plate','count noun','a flat dish for serving food','The bread is on a plate.')],
 ['follow a recipe','chop vegetables','a bowl of soup'],
 """Last month, Dan joined a cooking class because he wanted to prepare meals without buying expensive ready-made food. In the first lesson, the class made vegetable soup. The teacher gave everyone the same recipe, but asked each pair to choose one extra vegetable. Dan and his partner chose carrots.

First, they washed the vegetables and chopped them into small pieces. They then heated a little oil in a pan and cooked the onions for five minutes. After that, they added the other vegetables and some water. The soup cooked for twenty minutes. While they were waiting, Dan cut some bread and his partner set the table.

The recipe made four portions. There were only two people in each pair, so they put the remaining soup in labelled containers to take home. Dan thought his soup needed more salt, but the teacher suggested tasting it again before adding anything. He followed her advice and decided not to add more.

At the end of the class, each pair described one problem and one useful skill. Dan said that cutting the vegetables into similar-sized pieces was difficult at first. However, he was pleased that he could now explain the cooking process to someone else. The class was not a competition, and nobody received a prize.""",
 """Tutor: Tell me about the meal your pair made yesterday.
Nora: We made a salad and baked some bread. We started with the bread because it needed more time.
Tutor: What did you do first?
Nora: We mixed the flour and water. Then my partner prepared the vegetables while I worked on the dough.
Tutor: Did you put the bread straight into the oven?
Nora: No. We left it for thirty minutes first. After that, we baked it for twenty-five minutes.
Tutor: And the salad?
Nora: We washed the vegetables, cut them into small pieces and put them in a large bowl. We added the oil just before we served it.
Tutor: What went wrong?
Nora: We made too much salad. There were four of us, but we prepared enough for six people.
Tutor: Was the bread successful?
Nora: Yes, although the outside was a little dark. Next time, we will check it earlier. Our main problem was the quantity of salad, not the bread.""",
 [('short-answer','Why did Dan join the class? Use up to SIX WORDS for this formative question.','to avoid expensive ready-made food','The reason is in the opening sentence; this longer limit is teaching-specific, not a claimed IELTS default.'),
 ('ordering','Put these actions in order: add water; wash vegetables; cook onions; heat oil.','wash vegetables → heat oil → cook onions → add water','This is the stated cooking sequence.'),
 ('short-answer','For how many minutes were the onions cooked before the other vegetables were added?','five / 5','Twenty minutes refers to the later soup stage.'),
 ('truth','Each pair chose a different recipe. TRUE, FALSE or NOT GIVEN?','FALSE','Everyone received the same recipe, with a choice of one extra vegetable.'),
 ('short-answer','How many portions did the recipe make?','four / 4','The recipe made four portions, not two.'),
 ('truth','Dan added extra salt after speaking to the teacher. TRUE, FALSE or NOT GIVEN?','FALSE','He tasted again and decided not to add more.'),
 ('short-answer','What was Dan doing while the soup cooked?','cutting bread','The passage contrasts his action with his partner setting the table.'),
 ('choice','Which best describes the class: competitive, practical, or secretive?','practical','It developed usable skills and explicitly was not a competition.')],
 [('choice','Why did Nora start with the bread: it was more expensive, it needed longer, or the vegetables were unavailable?','it needed longer','Nora explicitly gives the time requirement.'),
 ('short-answer','What was mixed with flour? ONE WORD.','water','The first preparation step names flour and water.'),
 ('short-answer','How long was the bread left before baking? Give a number in minutes.','30','This is distinct from the twenty-five-minute baking period.'),
 ('short-answer','How long was the bread baked? Give a number in minutes.','25','The second duration refers to baking.'),
 ('choice','When was oil added: before washing, during chopping, or just before serving?','just before serving','The exact timing is stated near the end of the process.'),
 ('short-answer','How many people actually ate the meal?','four / 4','Six is the number for whom they accidentally prepared enough salad.'),
 ('choice','What was the main problem: salad quantity, burnt bread, or missing oil?','salad quantity','Nora explicitly contrasts the main problem with the bread.'),
 ('short-answer','What will they do earlier next time? Use up to THREE WORDS.','check the bread','The future adjustment is to check the bread earlier.')],
 'Describe a meal you made or an imaginary meal. Explain the sequence and one problem. Speak for 45–70 seconds. Answer: What would you do differently next time?',
 'Write 70–100 words about a cooking activity. Use past simple for the main events and one while-clause for a simultaneous action.',
 'Yesterday, my friend and I made soup. First, we washed and chopped the vegetables. We heated a little oil and cooked the onions. Then we added the other vegetables and some water. While the soup was cooking, I cut the bread and my friend set the table. We made four portions, although only two people were eating. We put the extra soup in containers. The meal tasted good, but next time we will use a smaller recipe.',
 'The instructional content is a fictional cooking account, not food-safety guidance. Grammar targets are past sequence, while and clear referents. Keep short-answer rules explicit; do not mark a semantically equivalent formative answer wrong merely because it is not verbatim.')
add(4,'Reading food labels without overgeneralising',[
 ('nutrition','uncountable noun','the process or study of obtaining and using food','The course introduces nutrition.'),
 ('nutrient','count noun','a substance in food that the body uses','The lesson compares nutrients.'),
 ('protein','noun','a nutrient needed for growth and repair','The label lists protein.'),
 ('carbohydrate','noun','a nutrient category that includes sugars and starches','The table includes carbohydrate.'),
 ('fat','noun','a nutrient found in foods such as oil and butter','The label shows the amount of fat.'),
 ('fibre','uncountable noun','plant material in food that is not fully digested','The cereal contains fibre.')],
 ['food label','portion size','rich in fibre'],
 """A community class asked its members to compare two imaginary breakfast cereals. The activity was designed to teach careful reading of labels, not to recommend a particular food. Each label gave the amount of several nutrients in a serving. However, the serving sizes were different: a serving of Cereal A was 40 grams, whereas a serving of Cereal B was 60 grams.

Several learners initially compared the figures directly and concluded that B contained more of every nutrient. The tutor asked them to check the serving sizes first. A fair comparison required the same quantity of each cereal. The learners therefore converted the figures to amounts per 100 grams before discussing the differences.

The class also examined the language on the front of each packet. Both products were described as natural, but the exercise provided no definition of that term. The tutor explained that the word alone did not establish which product would suit a particular person. The learners needed to identify the actual information available and separate it from an attractive description.

Finally, the groups wrote a short explanation for another learner. They were asked to say what could be concluded from the labels and what remained unknown. The labels did not describe the rest of a person's diet, their preferences or their individual needs. The class therefore avoided declaring one cereal the best choice for everyone. Its conclusion was narrower: comparisons are clearer when the quantities match and claims are supported by the information shown.""",
 """Tutor: What did your group notice about the two labels?
Maya: At first, we thought Cereal B had less sugar because its front label said light.
Tutor: Did the word light explain the sugar content?
Maya: No. We checked the numbers instead. Then we noticed that the serving sizes were different.
Owen: We nearly compared forty grams of A with sixty grams of B. We changed both to one hundred grams.
Tutor: Good. What happened to your conclusion?
Owen: It became more limited. We could compare the figures, but we could not say which cereal was best for every person.
Maya: We also wanted to compare price. A cost three pounds a packet and B cost four, but the packets were different sizes.
Tutor: How could you compare the prices more fairly?
Maya: By calculating the cost for the same weight.
Tutor: Exactly. What information was still missing?
Owen: We did not know what else a person ate. We also did not know which product they preferred.
Tutor: Then include those limits in your explanation. The aim is not to choose a universal winner; it is to make a justified comparison.""",
 [('short-answer','What was the serving size of Cereal A? Write a number and unit.','40 grams','The first paragraph gives the two different serving sizes.'),
 ('short-answer','What common quantity was used for comparison?','100 grams','The learners converted the figures to amounts per 100 grams.'),
 ('truth','The exercise recommended one cereal for all consumers. TRUE, FALSE or NOT GIVEN?','FALSE','The passage explicitly avoids a universal recommendation.'),
 ('truth','The activity defined the word natural precisely. TRUE, FALSE or NOT GIVEN?','FALSE','It says no definition was provided.'),
 ('truth','Cereal A tasted sweeter than Cereal B. TRUE, FALSE or NOT GIVEN?','NOT GIVEN','Taste was not reported.'),
 ('choice','The main purpose of the passage is to explain cooking, label comparison, or food storage.','label comparison','All paragraphs concern evaluating label information and its limits.'),
 ('short-answer','In they were asked in the final paragraph, who does they refer to?','the groups','The previous sentence identifies the groups writing explanations.'),
 ('rewrite','Rewrite without changing scope: The labels did not tell us everything about a person\'s diet.','The labels provided incomplete information about a person\'s diet.','A valid paraphrase must preserve the limitation, not claim that the labels contain no information.')],
 [('choice','What first led Maya to a conclusion about sugar: the numbers, the word light, or the price?','the word light','She initially relied on front-of-packet wording.'),
 ('short-answer','What quantity did they finally use for both products?','100 grams','Owen explicitly states the corrected common quantity.'),
 ('truth','The group concluded that one cereal was best for everyone. TRUE or FALSE?','FALSE','Owen says they could not make that universal claim.'),
 ('short-answer','What else did Maya want to compare? ONE WORD.','price','She introduces a separate price comparison.'),
 ('short-answer','What was the price of packet A? Give a number in pounds.','3','Four pounds is B\'s packet price.'),
 ('choice','Why could packet prices not be compared directly: different weights, different shops, or different currencies?','different weights','Maya says the packets were different sizes.'),
 ('short-answer','Name ONE kind of missing personal information.','diet / preferences','Owen names what else a person ate and which product they preferred.'),
 ('choice','The tutor wants a universal ranking, an attractive advertisement, or a justified comparison?','a justified comparison','This is the tutor\'s final explicit statement.')],
 'Explain why two labels or prices can be difficult to compare. Give an example and identify one thing that the information does not establish. Speak for 60–90 seconds.',
 'Write 100–150 words explaining the label-comparison activity. Include the initial error, the correction and one limitation. Do not give medical advice or invent nutrient figures.',
 'The class compared two cereal labels, but the serving sizes were not equal. Cereal A used a 40-gram serving and B used a 60-gram serving. Comparing the displayed figures directly could therefore be misleading. The learners converted both sets of figures to amounts per 100 grams. This gave them a common basis for comparison. They also questioned general descriptions such as natural, because the exercise did not define the term. Although the labels contained useful information, they did not describe a person\'s complete diet or preferences. The groups therefore explained the differences without claiming that one product was best for everyone.',
 'All brands and figures are fictional. This is a language and comparison exercise, not individual nutritional guidance. Teach clause/noun distinctions and mass nouns before the output; factual health implications are deliberately not assessed.')
add(5,'A surplus-food collection programme',[
 ('surplus','noun/adjective','more than is currently needed','The shop donated its surplus bread.'),
 ('shortage','count noun','a situation in which there is not enough of something','A shortage of drivers delayed collection.'),
 ('expiry','noun','the end of a stated period of validity','The form includes an expiry date.'),
 ('storage','uncountable noun','keeping goods until they are used','The programme needs suitable storage.'),
 ('preservation','uncountable noun','keeping something from being lost or spoiled','The discussion concerned food preservation.'),
 ('distribution','noun','the process of giving or delivering goods to different places','Distribution took longer than collection.')],
 ['surplus food','storage conditions','reduce consumption'],
 """A fictional town trialled a scheme for collecting surplus food from small shops. The organisers hoped to reduce the amount discarded at closing time while supplying a community kitchen. They began with four participating shops and a volunteer collection team. Each shop recorded how much food it offered and whether a volunteer collected it.

During the first month, the organisers counted every offered item as food saved. A review showed that this overstated the result: some items were not collected, and others could not be used by the kitchen. The team changed its records to distinguish food offered, food collected and food actually used. This made the results less impressive at first glance, but more informative.

The main difficulty was timing. Shops closed at different hours, and the kitchen could not receive deliveries late at night. The organisers therefore introduced two scheduled collection windows. They also asked shops to record the types and quantities of food before a driver arrived. Volunteers reported that these changes made planning easier, although they did not remove every delay.

A second issue concerned the purpose of the scheme. Some shop owners viewed donation as a solution to excess stock. The organisers agreed that redistribution could be useful, but argued that preventing avoidable surplus should remain a separate goal. A shop that ordered more accurately might donate less while also wasting less. Donation totals alone would not reveal that improvement.

At the end of the trial, the group did not claim to have eliminated food waste. It reported the quantities at each stage and described the remaining problems. The next trial would compare stock-planning support with collection support. The organisers wanted to know not only how much food moved through the programme, but why surplus arose and which changes reduced the amount that could not be used.""",
 """Coordinator: We need to agree what our report will count as a successful result.
Volunteer: Last week, the shops offered eighty boxes. Could we say that we saved eighty boxes of food?
Coordinator: Not exactly. How many were actually collected?
Volunteer: Sixty-eight. We missed one collection because the driver was unavailable.
Kitchen manager: And we used sixty of those boxes. Eight could not be included in our planned meals.
Volunteer: Then sixty is the figure for food used, not eighty.
Coordinator: Correct. We should report all three figures, with clear labels.
Kitchen manager: We also need to discuss timing. The late collection arrives after our team has finished work.
Volunteer: Could we ask every shop to close earlier?
Coordinator: That would not be realistic. I suggest moving our second collection window to six o'clock instead of eight.
Kitchen manager: Six would work better for us, provided that the delivery arrives by half past six.
Volunteer: Some shops may still have food left after that.
Coordinator: Yes, so this will be a trial rather than a complete solution. We should record what remains uncollected.
Kitchen manager: And please do not use a lower donation total as automatic evidence that a shop is doing worse. A shop might have reduced its surplus in the first place.
Coordinator: Exactly. We need to distinguish prevention from redistribution.""",
 [('choice','The trial aimed mainly to sell food, redistribute surplus, or replace all shops?','redistribute surplus','It collected surplus for a community kitchen.'),
 ('truth','Every item offered was used by the kitchen. TRUE, FALSE or NOT GIVEN?','FALSE','The review identified both uncollected and unusable items.'),
 ('short-answer','How many collection windows were introduced?','two / 2','The timing change introduced two scheduled windows.'),
 ('matching','Match the measure to its meaning: offered / collected / used.','offered = made available; collected = picked up; used = incorporated by the kitchen','The paragraph separates three different stages.'),
 ('truth','Lower donation totals necessarily indicate more waste. TRUE, FALSE or NOT GIVEN?','FALSE','Better ordering could reduce both donations and waste.'),
 ('short-answer','What two forms of support will the next trial compare?','stock-planning support and collection support','The final paragraph specifies the comparison.'),
 ('choice','Why were the revised results more useful: larger numbers, clearer distinctions, or no remaining problems?','clearer distinctions','The records became less visually impressive but more informative.'),
 ('truth','The programme was cheaper than every alternative. TRUE, FALSE or NOT GIVEN?','NOT GIVEN','No comparative cost evidence is supplied.')],
 [('short-answer','Boxes offered: write a number.','80','Eighty is the offered total.'),
 ('short-answer','Boxes collected: write a number.','68','Sixty-eight were actually picked up.'),
 ('short-answer','Boxes used: write a number.','60','Sixty were used; eight collected boxes were not.'),
 ('short-answer','Suggested time for the second collection: write a time.','6:00 / six o\'clock','Eight is the previous time, explicitly replaced by six.'),
 ('short-answer','Latest suitable arrival time: write a time.','6:30 / half past six','The kitchen manager makes acceptance conditional on this arrival time.'),
 ('choice','Which idea is rejected: earlier shop closing, reporting three totals, or recording leftovers?','earlier shop closing','The coordinator calls that proposal unrealistic.'),
 ('choice','What can a lower donation total indicate: better stock planning, necessarily more waste, or a larger driver team?','better stock planning','The kitchen manager explains the possibility.'),
 ('short-answer','What distinction does the coordinator emphasise at the end?','prevention and redistribution','These are the two explicitly contrasted aims.')],
 'Describe a local scheme that tries to solve a practical problem. Explain its goal, one difficulty and a better way to measure success. Speak for up to two minutes.',
 'Write 150–200 words answering: Is collecting surplus food enough to solve food waste? Use the fictional trial as an example, distinguish prevention from redistribution and acknowledge a limitation.',
 'Collecting surplus food can be useful, but it is not a complete response to food waste. In the fictional trial, donations supplied a community kitchen. However, the amount offered by shops was not the same as the amount collected or used. A programme could therefore report impressive donation figures while leaving important problems unresolved.\n\nBetter collection schedules may improve redistribution. For example, a delivery that arrives while the kitchen team is working is more likely to be useful than a late delivery. Nevertheless, redistribution addresses surplus after it has been produced. More accurate stock planning may prevent some of that surplus from arising. A shop might consequently donate less and waste less at the same time.\n\nThe programme should therefore measure several outcomes rather than reward donation totals alone. It needs records of what was offered, collected and used, alongside information about avoidable surplus. This would not guarantee that every item could be used, but it would support a more balanced evaluation.',
 'The longer text is an authored learning passage, not a calibrated IELTS Reading passage. The writing task is a bridge to Task 2, not a full official-length Task 2 task. Do not advertise 150–200 words as sufficient for the real Task 2.')
add(6,'Irrigation: interpreting a field comparison',[
 ('agriculture','uncountable noun','the activity of producing crops and raising farm animals','The project studied agriculture in the region.'),
 ('cultivation','uncountable noun','preparing land and growing crops','Cultivation began in spring.'),
 ('harvest','noun/verb','the collection of a crop when it is ready','The harvest was measured by weight.'),
 ('crop','count noun','a plant grown for food or another useful product','The farmers grew the same crop.'),
 ('yield','noun/verb','the amount produced by a crop or process','Yield increased in the second plot.'),
 ('irrigation','uncountable noun','supplying water to land or crops','The trial compared irrigation schedules.')],
 ['crop yield','soil quality','agricultural production'],
 """A fictional agricultural college compared two ways of scheduling irrigation on a small training farm. The purpose was not to identify the best system for all farms, but to investigate how a more regular schedule might affect water use and crop yield under local conditions. Two plots were planted with the same crop during the same season.

Plot A followed the farm's usual schedule. Plot B received smaller amounts of water at more frequent intervals. Over the growing period, A used 1,000 units of water and produced 200 units of crop. B used 800 units of water and produced 190 units of crop. The college used invented units for the teaching exercise so that students could focus on the relationships between the figures rather than on a particular crop.

At first, one group described B as better because it used less water. Another group preferred A because it produced more crop. The tutor asked both groups to make their criteria explicit. If the objective was the greatest total harvest from the plot, A performed better. If the objective was crop produced per unit of water, B performed better. A produced 0.2 units of crop per unit of water; B produced 0.2375. These are different measures, not contradictory calculations.

The students then considered what the comparison could establish. The plots were not identical in every respect. Soil depth varied, and the experiment was carried out in only one season. The students had no evidence about how the schedules would perform during a much drier year or with a different crop. They therefore avoided saying that the irrigation schedule alone had caused the entire difference.

The practical recommendation was to repeat the comparison under more controlled and varied conditions. The college would also record labour requirements because a frequent watering schedule might require different management. A method that saved water could still be difficult to operate in another setting.

In their final report, the students presented total water use, total yield and yield per unit of water separately. They explained the calculation and acknowledged the limits of the comparison. The exercise showed why the word better is incomplete unless the writer identifies the outcome, the conditions and the evidence used to judge it.""",
 """Tutor: How will you summarise the comparison?
Student A: Plot B used twenty percent less water, so I was going to say it was the better system.
Tutor: Better according to which measure?
Student A: Water use. A used one thousand units and B used eight hundred.
Student B: But A produced two hundred units of crop, compared with one hundred and ninety for B. If we report only water use, we hide that difference.
Tutor: Exactly. Can you calculate crop per unit of water?
Student B: For A, two hundred divided by one thousand is zero point two. For B, one hundred and ninety divided by eight hundred is zero point two three seven five.
Student A: So B produced more crop for each unit of water, although its total harvest was lower.
Tutor: That is a clearer comparison. What should you avoid claiming?
Student A: That the watering schedule caused everything. The soil was not exactly the same in the two plots.
Student B: We should also mention that this was one season. The result might be different in another year.
Tutor: Good. What additional information would help with a practical decision?
Student B: Labour requirements. More frequent watering could take more work.
Student A: And the cost of operating each system. We do not have those figures yet.
Tutor: Then state that they are missing. Do not invent a cost advantage just because one method used less water. End with a recommendation to repeat the comparison, not a claim that the issue has been settled.""",
 [('short-answer','Which plot used 800 units of water?','B / Plot B','The second paragraph states the totals.'),
 ('short-answer','Which plot produced the larger total harvest?','A / Plot A','A produced 200 units, compared with 190 for B.'),
 ('short-answer','What was crop per unit of water for B? Write a decimal.','0.2375','190 divided by 800 gives 0.2375.'),
 ('truth','B performed better on every reported measure. TRUE, FALSE or NOT GIVEN?','FALSE','It had lower total yield although higher yield per water unit.'),
 ('truth','The two plots had identical soil depth. TRUE, FALSE or NOT GIVEN?','FALSE','The passage states that soil depth varied.'),
 ('truth','The more frequent schedule required twice as much labour. TRUE, FALSE or NOT GIVEN?','NOT GIVEN','Labour requirements were not yet recorded.'),
 ('choice','Why repeat the comparison: to test varied conditions, to hide the lower yield, or to avoid using numbers?','to test varied conditions','The recommended repetition addresses the limited conditions and controls.'),
 ('rewrite','Paraphrase without changing scope: B produced more crop per unit of water, but less crop overall.','B was more water-efficient on this measure, although its total yield was lower.','The comparison must preserve both measures and the limited scope.')],
 [('short-answer','By what percentage was water use lower in B?','20%','The decrease from 1,000 to 800 is 200/1,000.'),
 ('short-answer','What was the total crop from B?','190','This is the yield, not the water use.'),
 ('short-answer','What was A\'s crop per unit of water?','0.2','The speakers calculate 200/1,000.'),
 ('choice','Which factor limits the causal interpretation: identical soil, different soil, or no crop measurements?','different soil','The speakers identify unequal soil as a possible alternative influence.'),
 ('short-answer','How many seasons were observed?','one / 1','One season is explicitly noted as a limitation.'),
 ('short-answer','Name ONE missing practical measure.','labour requirements / operating cost','Both are identified as missing.'),
 ('choice','The tutor recommends a final universal verdict, repeated comparison, or removing all figures.','repeated comparison','The ending explicitly rejects a settled universal conclusion.'),
 ('truth','Lower water use establishes that the system is cheaper. TRUE or FALSE?','FALSE','The tutor warns not to invent that cost advantage.')],
 'Explain why two systems can each be better on different measures. Use the irrigation comparison, then give another example. Respond to the follow-up: How should a decision-maker choose between the measures?',
 'Academic Task 1-style practice: summarise the fictional data in at least 150 words. A: water 1,000, yield 200; B: water 800, yield 190. Include an overview and accurate comparisons. Do not infer costs, profitability or causation.',
 'The table compares water use and crop production for two plots on a fictional training farm. Plot A used the usual irrigation schedule, whereas Plot B received smaller amounts of water more frequently.\n\nOverall, A produced the larger total harvest, but B used less water and generated more crop per unit of water. The two plots therefore performed differently depending on the measure considered.\n\nWater consumption was 1,000 units in A and 800 in B, so B used 200 fewer units, a reduction of 20% relative to A. Crop production was also lower in B, at 190 units compared with 200 in A. This difference was 10 units, or 5% of A\'s yield.\n\nWhen production is expressed relative to water use, A produced 0.2 units of crop per unit of water. The corresponding figure for B was 0.2375. Thus, although B\'s total harvest was slightly smaller, its output for each unit of water was higher. The table contains no information about operating costs or labour requirements.',
 'The original passage includes a numerical reasoning bridge; do not interpret a failure in unfamiliar arithmetic as language failure without separate diagnosis. Use an accessible data table, consistent units and a server-checked calculation. This is not real agronomic evidence.')
add(7,'Food policy: incentives, choice and scope',[
 ('subsidy','count noun','financial support intended to lower a cost or support an activity','The fictional scheme offered a subsidy.'),
 ('regulation','noun','an official rule or the process of making such rules','The group discussed regulation.'),
 ('taxation','uncountable noun','the system of collecting taxes','Taxation was one proposed source of funding.'),
 ('incentive','count noun','something that encourages a particular action','A discount can create an incentive.'),
 ('affordability','uncountable noun','how easily a cost can be paid','The review examined affordability.'),
 ('availability','uncountable noun','whether something can be obtained','Price alone does not describe availability.')],
 ['economic incentive','consumer choice','unintended consequence'],
 """In an imaginary city, a council proposed subsidising fresh ingredients in neighbourhood shops. Its stated aim was to make a wider range of food affordable, rather than to require residents to buy particular products. Participating retailers would receive a payment for each eligible item sold at the reduced price. The council planned to evaluate the programme after six months.

The proposal attracted support from residents who wanted more affordable options. However, a consultation exposed several questions that the original plan had not addressed. A lower price would help only if the products were available at convenient times and locations. Some residents worked late, while some participating shops closed early. Others had limited cooking facilities. These concerns did not show that the subsidy would be useless, but they challenged the assumption that price was the only relevant barrier.

Retailers raised a different issue. The initial proposal measured success by the number of subsidised items sold. A shop could increase that figure by attracting customers who would have bought the same ingredients elsewhere at the usual price. Higher sales in a participating shop would not necessarily mean that more households had gained access to food. The evaluation would therefore need to distinguish changes in where people shopped from changes in what they could obtain.

One councillor argued for a mandatory programme covering every shop. Another preferred a voluntary trial, partly because smaller retailers might find the reporting requirements difficult. The discussion was not simply a choice between action and inaction. Participants disagreed about how broadly the policy should apply, how its costs should be shared and what evidence would justify expansion.

The final proposal retained the subsidy but added a small number of late-opening outlets. It also required the evaluation to report who used the scheme and whether those users experienced fewer access difficulties. These measures would not resolve every concern. For example, the plan still lacked a clear approach for residents without suitable cooking facilities.

The council consequently described the programme as a bounded trial. It would consider wider implementation if the evaluation showed improved access without disproportionate administrative costs. The policy's defenders accepted that a promising mechanism was not the same as a demonstrated effect. Its critics, meanwhile, agreed that the unresolved questions were reasons for careful evaluation rather than automatic proof that no intervention could work.""",
 """Chair: We have agreed that the trial should make ingredients more affordable. What would count as evidence of success?
Analyst: The simplest measure is sales of subsidised items, but it is not sufficient on its own.
Retailer: Why not? If we sell more of those items, surely the policy is working.
Analyst: It may be working, but the sales could include people who have simply moved from another shop. We need to know whether access has improved, not just whether purchases have moved.
Resident: Opening hours matter too. My shift finishes at seven, after most of the participating shops close. A reduced price is not useful to me if I cannot reach the shop in time.
Chair: Would adding one late-opening outlet solve that problem?
Resident: It would help some people, provided that it is easy to reach. I would not assume it solves the problem for everyone.
Retailer: Small shops will also need support with the records. A complicated claim form could cost us more time than the payment is worth.
Analyst: Then administrative cost should be another outcome. We can record it separately from sales and access.
Chair: Should participation be compulsory?
Retailer: I would prefer a voluntary trial first. That does not mean I oppose the policy; I am concerned about how it is implemented.
Resident: I support a trial, but it should include people with different working hours. Otherwise, we might miss the very barriers we are trying to understand.
Analyst: Agreed. We should state the conditions for expansion now. An increase in sales alone should not trigger a city-wide programme.
Chair: So our conclusion is conditional: test the subsidy, improve the range of opening hours, measure access and reporting costs, and review the evidence before expanding.""",
 [('choice','What is the stated aim: require a diet, improve affordability, or close small shops?','improve affordability','The opening contrasts wider affordable choice with compulsory purchasing.'),
 ('truth','The consultation established that subsidies can never work. TRUE, FALSE or NOT GIVEN?','FALSE','It identifies limitations without dismissing the mechanism universally.'),
 ('short-answer','Name ONE non-price barrier mentioned in the passage.','opening hours / location / limited cooking facilities','These are explicitly stated barriers.'),
 ('choice','Why are sales insufficient as the only outcome: they cannot be counted, shoppers may switch shops, or prices never change?','shoppers may switch shops','A rise can reflect relocation rather than improved access.'),
 ('truth','Every retailer favoured compulsory participation. TRUE, FALSE or NOT GIVEN?','NOT GIVEN','Positions of every retailer are not stated; councillors held differing views.'),
 ('short-answer','How long was the planned evaluation period?','six months','The opening gives the period.'),
 ('choice','Which best captures the conclusion: expand immediately, abandon all intervention, or evaluate a bounded trial?','evaluate a bounded trial','The final proposal retains the trial with explicit limits and review.'),
 ('rewrite','Preserve the meaning: The subsidy may improve access if other barriers are addressed.','Addressing other barriers could allow the subsidy to improve access.','Retain the possibility and condition; do not turn either into certainty.')],
 [('choice','What does the analyst reject: sales measurement, sales as the sole measure, or all subsidies?','sales as the sole measure','Sales are useful but insufficient alone.'),
 ('short-answer','At what time does the resident\'s shift finish?','seven / 7:00','This explains the conflict with shop hours.'),
 ('choice','The resident considers one late-opening shop sufficient for everyone, helpful for some, or entirely useless.','helpful for some','The resident explicitly qualifies the benefit.'),
 ('short-answer','Which additional cost does the retailer want considered?','administrative cost / reporting cost','The claim-form workload is the concern.'),
 ('choice','Does the retailer oppose the policy, oppose all trials, or prefer a voluntary trial?','prefer a voluntary trial','The retailer separates implementation concerns from outright opposition.'),
 ('short-answer','Whose differing circumstances should the trial include?','people with different working hours','The resident requests this inclusion.'),
 ('truth','The analyst says higher sales alone should trigger expansion. TRUE or FALSE?','FALSE','The analyst explicitly says they should not.'),
 ('short-answer','Name TWO outcome categories other than sales.','access and reporting costs','The chair\'s conclusion includes both.')],
 'Discuss whether lower prices are enough to make a service accessible. Explain two other barriers and respond to a follow-up that challenges your proposed solution.',
 'Task 2-style practice: Some people believe governments should reduce the price of healthier food. Others think consumers should make food choices without government intervention. Discuss both views and give your own opinion. Write at least 250 words. Do not invent research or statistics.',
 """Governments can influence food prices, but whether they should do so depends on the purpose and design of the intervention. In my view, limited support that expands affordable choices can be justified, provided that its effects are evaluated and it does not treat price as the only obstacle.

Supporters of lower prices argue that choice is restricted when desirable products are unaffordable. A subsidy could allow a household to consider options it would otherwise exclude. It might also encourage retailers to stock a wider range of ingredients. From this perspective, the intervention does not necessarily remove personal choice; it can expand the choices people are able to make.

The opposing view nevertheless raises important concerns. Public money has alternative uses, and a programme may subsidise purchases that would have happened anyway. It may also favour some retailers or products without a clear justification. Furthermore, a cheaper ingredient is not automatically practical for someone who lacks cooking facilities or cannot reach a participating shop. A policy based only on sales figures could overlook these limitations.

I would therefore favour a carefully bounded trial rather than an immediate universal programme. Its evaluation should examine whether access improves for the intended users, how much administration costs and whether other barriers remain. Consumers should retain the freedom to choose, while the government should explain why particular forms of support are warranted.

Ultimately, the relevant question is not whether government action or personal responsibility should completely replace the other. It is whether a specific intervention improves people's options at a defensible cost. A policy that meets that test may deserve support; one that merely produces attractive sales totals may not.""",
 'The original essay illustrates balanced development, not a prescribed structure. The trial is fictional and does not establish real subsidy effectiveness. Productive scoring must assess task coverage and reasoning, not whether the learner shares the model\'s position.')
add(8,'Supply chains: efficient in which circumstances?',[
 ('interdependence','noun','a situation in which parts depend on each other','The network showed strong interdependence.'),
 ('resilience','noun','the ability to continue or recover when conditions become difficult','The review examined resilience.'),
 ('volatility','noun','frequent or substantial variation','The buyers faced price volatility.'),
 ('distribution','noun','the organisation of movement or allocation across places','Distribution was interrupted.'),
 ('scarcity','noun','a limited supply relative to what is needed','The exercise considered resource scarcity.'),
 ('surplus','noun','an amount beyond current requirements','One depot held a surplus.')],
 ['food security','supply-chain resilience','price volatility'],
 """A fictional food distributor was deciding whether to keep one central warehouse or maintain several smaller depots. The central warehouse was cheaper to operate under ordinary conditions. It allowed the company to combine deliveries and use its storage space more intensively. On the information initially presented to the board, consolidation appeared to be the obvious choice.

The first report, however, measured average operating cost during a period without major disruption. It did not examine what would happen if the central site became inaccessible. A second team therefore developed three hypothetical scenarios: ordinary operations, a short interruption at the central site and simultaneous delays affecting several transport routes. These were decision exercises, not forecasts of events that were certain to occur.

Under ordinary operations, the central option retained its cost advantage. During an interruption at that site, the network of smaller depots could continue serving some areas, although transferring stock between depots would add expense. In the third scenario, neither arrangement was unaffected. Dispersed storage did not protect the company from every form of disruption, especially when multiple routes were delayed together.

The discussion consequently moved from a simple ranking to a comparison of conditions. A director who favoured consolidation argued that maintaining spare capacity could be expensive. A colleague accepted this but asked whether the analysis was treating unused capacity as worthless merely because it was not needed every day. Its value might lie partly in the options it preserved during an interruption.

There was also a distributional issue. The average number of completed deliveries could conceal different experiences across neighbourhoods. A system that restored service quickly in the centre but slowly in outlying areas might look satisfactory in an aggregate report. The review team therefore proposed reporting recovery times by area rather than relying on a single company-wide average.

No final arrangement was declared universally superior. Instead, the board requested a comparison that made the chosen objectives explicit: ordinary cost, continuity during disruption and the distribution of service recovery. It also asked the team to identify which assumptions had the greatest influence on the ranking.

The exercise did not show that efficiency and resilience must always conflict. Some changes could improve both, such as more reliable information about stock. Nor did it show that resilience could be purchased simply by adding warehouses. The more defensible conclusion was that a system should be evaluated against a range of relevant conditions. An option selected solely for its performance in one narrow setting may be less attractive when the decision-maker considers what happens outside that setting.""",
 """Student A: Our first draft says that several depots are more resilient than one warehouse. Is that too broad?
Student B: I think so. They performed better when the central site was interrupted, but not every disruption had the same pattern.
Tutor: Which scenario challenges the general statement?
Student B: The simultaneous transport delays. Several depots still depended on those routes, so spreading the storage did not remove the shared exposure.
Student A: Then we could say that the smaller depots preserved more service in the central-site interruption scenario.
Tutor: That is more precise. What about cost?
Student A: The central warehouse was cheaper during ordinary operations. The report did not show that it would be cheaper under every condition.
Student B: I also want to change our treatment of spare capacity. We called it wasted space, but that assumes its only value is everyday use.
Tutor: How could you explain the alternative without claiming spare capacity is always worth its cost?
Student B: It can preserve options during a disruption. Whether that justifies the cost depends on the risks, the service objectives and the alternatives.
Student A: We also need a clearer measure of recovery. The company-wide average hides differences between areas.
Tutor: What would you report instead?
Student A: Recovery time for each area, alongside the average. That would show whether some neighbourhoods remain without service for much longer.
Student B: So our recommendation should identify the relevant scenarios and objectives rather than name a universal winner.
Tutor: Yes. And remember that your scenarios are tools for examining decisions. Do not describe them as predictions that these exact events will happen. A good final paragraph should explain which conclusions are supported, which depend on assumptions and what information would help the board decide.""",
 [('choice','Why did the central warehouse initially seem preferable: lower ordinary costs, immunity to disruption, or equal recovery everywhere?','lower ordinary costs','Only ordinary operating costs supported the initial ranking.'),
 ('truth','The scenarios were predictions of events certain to happen. TRUE, FALSE or NOT GIVEN?','FALSE','They were explicitly decision exercises, not certain forecasts.'),
 ('short-answer','Which scenario showed that multiple depots shared a vulnerability?','simultaneous transport delays','Shared routes could affect multiple depots.'),
 ('choice','What potential value did spare capacity have: preserving options, guaranteeing profits, or eliminating every risk?','preserving options','The text suggests an option value without a universal benefit claim.'),
 ('truth','The outlying areas recovered in exactly ten days. TRUE, FALSE or NOT GIVEN?','NOT GIVEN','No numerical recovery times are supplied.'),
 ('short-answer','What reporting change was proposed to reveal unequal recovery?','report recovery times by area','The review would disaggregate the company-wide average.'),
 ('truth','The passage says efficiency and resilience always conflict. TRUE, FALSE or NOT GIVEN?','FALSE','The final paragraph explicitly rejects that universal claim.'),
 ('short-answer','Name one change that could improve both objectives.','more reliable stock information','This is the example given in the final paragraph.')],
 [('choice','Which draft claim is revised: depots are always more resilient, ordinary costs matter, or routes can be delayed?','depots are always more resilient','The students narrow a general claim to a particular scenario.'),
 ('short-answer','What shared exposure remained despite dispersed storage?','transport routes','The same delayed routes could affect several depots.'),
 ('choice','The central option was cheaper under ordinary conditions, all conditions, or no conditions.','ordinary conditions','The student explicitly limits the cost finding.'),
 ('short-answer','What loaded expression did the students use for spare capacity?','wasted space','They reconsider the assumption embedded in this phrase.'),
 ('short-answer','What should accompany the overall average?','recovery time for each area','This exposes the distribution of recovery.'),
 ('truth','The tutor says the scenarios prove exactly what will happen. TRUE or FALSE?','FALSE','The tutor distinguishes decision tools from predictions.'),
 ('choice','The final recommendation should be conditional, universal, or unsupported.','conditional','It should specify assumptions and relevant objectives.'),
 ('rewrite','State the revised resilience claim in one sentence.','The smaller depots preserved more service when the central site was interrupted.','A correct answer retains the specific scenario rather than asserting universal superiority.')],
 'Is an efficient system necessarily a reliable one? Develop a position, acknowledge a counterexample and explain what information would change your view.',
 'Task 2-style practice: Some organisations aim to minimise costs, while others keep spare capacity to deal with unexpected problems. Discuss both approaches and give your opinion. Write at least 250 words.',
 """Keeping costs low is a legitimate organisational goal, but it should not be confused with choosing the cheapest arrangement under a single set of conditions. In my view, organisations should examine both ordinary efficiency and their ability to maintain essential services when conditions change.

The case for minimising costs is straightforward. Money spent on unused facilities or duplicated systems cannot be used elsewhere. Consolidating operations may simplify coordination and make better use of staff and equipment. Where interruptions are limited and alternative suppliers are readily available, extensive spare capacity may provide little additional value.

However, an arrangement that is inexpensive in normal times can be costly when a critical component fails. Spare capacity may allow an organisation to continue operating or recover sooner. Its value is therefore not captured fully by measuring how intensively it is used every day. A reserve facility that is rarely needed is not necessarily pointless, just as frequent use does not automatically justify a costly investment.

The difficulty is that additional capacity does not protect against every problem. Several facilities may still depend on the same transport route or information system. Organisations should consequently compare realistic sources of disruption rather than assume that duplication guarantees resilience. They should also consider who experiences the consequences: an acceptable average recovery time may conceal long delays for some users.

I would favour a decision process with explicit service objectives, several plausible operating conditions and transparent costs. This may justify spare capacity in one setting and consolidation in another. The strongest policy is not an absolute commitment to either maximum efficiency or maximum redundancy, but a defensible balance that can be revised as evidence changes.""",
 'The source is fictional organisational reasoning. Avoid coaching rare terminology as a substitute for answering the question. The discussion task practises spontaneous qualification; a learner can reach an excellent answer using simpler accurate vocabulary.')
add(9,'Uncertain supply: forecasts and decisions',[
 ('resilience','noun','the capacity to withstand or recover from disruption','The group considered supply resilience.'),
 ('vulnerability','noun','exposure to possible harm or disruption','A single route created vulnerability.'),
 ('diversification','noun','spreading activity across different sources or options','Supplier diversification reduced dependence on one source.'),
 ('contingency','noun','a possible future event requiring a response','The plan included a contingency.'),
 ('buffer','noun','a reserve or margin that reduces the effect of variation','The warehouse held a small buffer.'),
 ('volatility','noun','substantial or frequent change in a quantity','The buyers faced price volatility.')],
 ['contingency planning','buffer capacity','systemic risk'],
 """The purchasing team of a fictional college had to choose how much reserve food to hold for the next term. A large reserve would occupy storage space and could lead to unused stock. A very small reserve would leave the kitchen more exposed to delivery interruptions. The team asked an analyst to estimate how often interruptions might occur.

The analyst examined the college's records and found interruptions in eight of the previous forty teaching weeks. She described the observed frequency as 20%. Several committee members interpreted this as a forecast that exactly eight of the next forty weeks would also be affected. The analyst objected. The historical proportion summarised the available record; it did not guarantee the number of future interruptions. Delivery arrangements, weather conditions and the completeness of the records might all differ.

The records also contained a classification problem. Some entries counted a delivery as interrupted when it arrived a few hours late, even if no meal was affected. Other entries recorded only failures that required a menu change. Combining the two without qualification would treat unlike events as equivalent. Before refining the estimate, the team needed to agree what outcome mattered for its decision.

The kitchen manager proposed measuring whether the college could serve its planned meals. The purchasing officer preferred delivery punctuality because it was easier to record. These measures were related, but neither could simply replace the other. A late delivery might have no consequence if suitable stock was already available. Conversely, an on-time delivery might still contain an unexpected shortage. The committee decided to report both, while treating continuity of meals as the primary service objective.

Next, the analyst compared three reserve policies under several hypothetical interruption patterns. She did not assign a single most likely pattern because the available records were too inconsistent to justify a precise forecast. Instead, she asked which policy remained acceptable across a reasonably broad range of conditions. A middle-sized reserve performed adequately in more of the tested situations than the smallest reserve, without the storage burden of the largest.

This did not establish a universally optimal reserve. The ranking depended on assumptions about storage cost, substitution between ingredients and how quickly suppliers could recover. The team therefore proposed a provisional policy with a review date. It would also improve the records so that later decisions could rely on more comparable evidence.

The main lesson was not that uncertainty made planning impossible. Rather, uncertainty changed what a responsible recommendation looked like. The team could choose a policy while acknowledging that its justification was conditional. It could specify what was being protected, which assumptions mattered and which observations would trigger a review. That was more informative than presenting a precise historical percentage as a guarantee about the future.""",
 """Chair: We have a figure of twenty percent. Does that mean we should expect exactly eight interruptions next term?
Analyst: No. Eight out of forty is what the historical record shows. It is not a promise about the next forty weeks.
Purchasing officer: But surely it is our best number?
Analyst: It may be a useful starting point, but the entries were not recorded consistently. Some describe a late delivery; others describe a failure that actually changed a meal.
Kitchen manager: Then we are combining two different outcomes. A late truck does not always stop us serving lunch.
Purchasing officer: Punctuality is easier to measure than meal continuity.
Kitchen manager: That is true, but ease of measurement does not make it the same thing. We could have an on-time delivery that is missing an essential ingredient.
Chair: Could we keep both measures?
Analyst: Yes, provided that we label them clearly. We should also decide which is primary for the reserve policy.
Kitchen manager: Our main responsibility is to serve the planned meals. I would make continuity the primary outcome.
Chair: And what did the scenario comparison suggest?
Analyst: The medium reserve was acceptable across more tested conditions than the small one. The largest reserve offered additional protection in some cases, but required more storage.
Purchasing officer: So the medium reserve is definitely optimal?
Analyst: Only under the assumptions we tested. If recovery takes much longer, or ingredient substitution is less practical than we assumed, the ranking may change.
Chair: Then we should adopt it provisionally, improve the records and state a review trigger.
Kitchen manager: What would that trigger be?
Analyst: For this trial, we could review the policy if reserve shortages disrupt two planned meals within a four-week period. That threshold is a management choice, not something the historical percentage proves.
Chair: Include that distinction in the report. We need a usable decision, but we should not hide its assumptions behind a precise number.""",
 [('short-answer','How many historical teaching weeks were examined?','40','The record contained forty weeks, of which eight had interruptions.'),
 ('truth','The historical rate guarantees eight interruptions in the next forty weeks. TRUE, FALSE or NOT GIVEN?','FALSE','The analyst explicitly rejects that interpretation.'),
 ('short-answer','What inconsistency affected the records?','different definitions of interruption','Some entries counted lateness, others meal-changing failures.'),
 ('choice','Why is punctuality not identical to meal continuity: they concern unrelated services, late deliveries always stop meals, or deliveries can be late without affecting meals?','deliveries can be late without affecting meals','The passage also gives the converse example of on-time but incomplete deliveries.'),
 ('short-answer','What primary outcome did the committee select?','continuity of meals','It retained both measures but prioritised continuity.'),
 ('truth','The analyst assigned exact probabilities to every scenario. TRUE, FALSE or NOT GIVEN?','FALSE','The inconsistent records did not justify a precise forecast.'),
 ('choice','Why was the middle reserve proposed: universally best, conditionally acceptable across scenarios, or entirely cost-free?','conditionally acceptable across scenarios','Its advantages depended on the tested assumptions.'),
 ('short-answer','Name ONE assumption that could change the ranking.','storage cost / ingredient substitution / supplier recovery speed','All are explicitly named in the penultimate paragraph.')],
 [('choice','The 20% figure is an observed historical frequency, a guarantee, or an official threshold.','an observed historical frequency','The analyst distinguishes description from future certainty.'),
 ('short-answer','What is easier for the purchasing officer to measure?','punctuality','The officer contrasts it with meal continuity.'),
 ('choice','Which outcome is primary: truck speed, meal continuity, or warehouse size?','meal continuity','The kitchen manager states the service objective.'),
 ('short-answer','Which reserve policy is proposed provisionally?','medium reserve','The analyst describes the medium option as broadly acceptable under tested conditions.'),
 ('short-answer','How many disrupted meals would trigger the proposed review?','two / 2','This is an explicit management threshold.'),
 ('short-answer','Over what period would the review trigger be counted?','four weeks','The proposed window is four weeks.'),
 ('truth','The threshold was statistically proved optimal by the historical rate. TRUE or FALSE?','FALSE','The analyst explicitly calls it a management choice.'),
 ('short-answer','Name ONE change that could alter the ranking.','longer recovery / less feasible ingredient substitution','Both are identified in the discussion.')],
 'Should decision-makers wait for certainty before acting? Give a balanced answer, distinguish useful estimates from guarantees and explain how a provisional decision can be reviewed.',
 'Task 2-style practice: Some people think decisions should only be made when enough information is available. Others believe waiting for more information often causes greater problems. Discuss both views and give your own opinion. Write at least 250 words.',
 """Good decisions require evidence, but evidence is rarely complete at the moment a decision is needed. I therefore disagree with both an absolute demand for certainty and an assumption that acting quickly is always preferable. The appropriate response depends on the consequences of error, the cost of delay and the possibility of revising the decision.

Waiting can be sensible when important information is likely to become available soon. A small amount of additional investigation may expose an unsuitable assumption or prevent an expensive commitment. This is particularly valuable when the proposed action is difficult to reverse. Describing caution as indecision would ignore the genuine value of learning before committing resources.

However, delay also has consequences. An organisation that waits for perfect information may fail to maintain an essential service or miss an opportunity that will not return. Moreover, more data are not necessarily more informative if they measure the wrong outcome or combine incompatible definitions. The goal should be sufficient, relevant evidence rather than the largest possible quantity of information.

A useful compromise is a bounded decision with explicit assumptions and review conditions. For example, an organisation could test a policy on a limited scale, monitor the outcome that matters and revise the approach if performance falls below a stated level. This does not eliminate risk, but it makes the uncertainty visible and reduces the chance that a provisional choice becomes an unquestioned permanent policy.

In my view, decision-makers should explain not only what they recommend but also why the available evidence is adequate for that particular commitment. Some situations justify waiting; others justify cautious action. The strongest approach is one that treats uncertainty as a factor to manage, rather than either a reason to do nothing or an inconvenience to conceal.""",
 'This pack explicitly models the distinction between research-supported principles and chosen thresholds. The two-meal/four-week threshold is fictional product policy, not a scientific rule. High-band quality depends on precise scope and reasoning, not on citing terminology.')
add(10,'An agricultural pilot: adoption is not effectiveness',[
 ('innovation','noun','a new method, idea or product','The pilot tested an innovation.'),
 ('diffusion','noun','the spread of something across people or places','The study examined diffusion of the method.'),
 ('adoption','noun','starting to use a method or product','Adoption increased during the trial.'),
 ('productivity','noun','output in relation to the resources used','The team compared productivity.'),
 ('resilience','noun','capacity to maintain or restore functioning under difficulty','Resilience was a separate objective.'),
 ('externality','count noun','an effect on others not fully reflected in a transaction or decision','The discussion considered an environmental externality.')],
 ['adoption barrier','context-dependent effect','scalable intervention'],
 """A fictional extension service offered farmers a new scheduling tool. The tool was intended to help users decide when to carry out several routine tasks. Participation in the first pilot was voluntary, and forty farmers enrolled. At the end of the season, thirty were still using the tool. The service described the 75% continuation rate as encouraging and proposed expanding access.

A reviewer agreed that continued use was relevant, but questioned the conclusion drawn from it. Adoption and effectiveness were not identical outcomes. Farmers might continue using a tool because it was convenient, because they had received support, or because they expected a benefit that had not yet appeared. Conversely, someone might stop using a potentially useful tool because of an unreliable connection or a confusing interface. A continuation rate alone could not establish the effect on farm performance.

The service had also compared the enrolled farmers with a group that had not joined. The enrolled group reported a larger average improvement in output. However, the groups differed before the pilot began. Volunteers were more likely to have previously used digital planning tools and to have requested technical advice. These differences created an alternative explanation for the observed comparison. The reviewer did not claim that the new tool had no benefit; she argued that the evidence did not isolate its contribution.

A further issue concerned the support provided during the pilot. Participants received individual help from an adviser, while non-participants did not. The service was considering a wider release with much less adviser time per farmer. Even if the pilot package were effective, its results would not automatically describe the effect of the tool without comparable support.

The proposed next phase therefore separated several questions. Would farmers adopt the tool when access was offered more broadly? Would using it improve the outcomes the service cared about? Which users benefited, under which conditions, and with what level of assistance? Answering one question would inform, but not settle, the others.

The revised plan included clearer outcome definitions, baseline measurements and a comparison designed to reduce selection differences. It also required records of technical support and reasons for discontinuation. The team would report uncertainty and variation between participants rather than rely only on the overall average.

The debate illustrates why promising pilot results can support further investigation without justifying every claim made on their behalf. A programme may be worth expanding experimentally even when its causal effects remain uncertain. What matters is that expansion is framed as a way to learn, not presented as if the pilot had already proved effectiveness at scale. Equally, identifying a limitation should not be turned into an unsupported declaration of failure. The appropriate conclusion lies in specifying what the evidence establishes and what the next comparison needs to resolve.""",
 """Programme lead: Thirty of forty participants continued using the tool. That is seventy-five percent, so our first sentence says the tool was effective for three quarters of farmers.
Reviewer: I would revise that sentence. It establishes continued use among participants, not effectiveness for all farmers.
Programme lead: But continued use is encouraging, isn't it?
Reviewer: Yes. I am not suggesting that it is irrelevant. I am saying that the label must match the measure.
Analyst: We also found a larger average output improvement among participants than among non-participants.
Reviewer: Were the groups comparable before the trial?
Analyst: Not entirely. The volunteers had more experience with digital tools and had asked for advice more often.
Reviewer: Then the observed difference could reflect more than the new tool. It does not show that the tool had no effect, but it does limit the causal claim.
Programme lead: We could still make the tool available to more farmers.
Reviewer: Certainly, provided that the next phase is designed to learn. I would distinguish offering wider access from claiming that success at scale is already established.
Analyst: There is another complication. The pilot included individual adviser support. The larger programme would provide mainly written guidance.
Reviewer: Then the intervention would not be exactly the same package. You need to record the support level and avoid transferring the pilot result without qualification.
Programme lead: What should the revised report say?
Analyst: That continued use was substantial within the volunteer group, that performance comparisons are subject to baseline differences, and that the effect of reduced support is unknown.
Reviewer: That is much stronger. We can then specify the next comparison, the outcomes and the conditions under which the result would justify further expansion.
Programme lead: So we should not replace an overconfident success claim with an equally overconfident failure claim.
Reviewer: Exactly. A limitation narrows an inference; it does not automatically reverse it.""",
 [('short-answer','How many of the forty participants continued using the tool?','30','The opening gives the numerator for the continuation rate.'),
 ('truth','Continued use and improved farm performance are defined as the same outcome. TRUE, FALSE or NOT GIVEN?','FALSE','The reviewer explicitly distinguishes adoption from effectiveness.'),
 ('short-answer','Name ONE pre-existing difference between the groups.','digital-tool experience / previous requests for technical advice','These differences predated the pilot.'),
 ('choice','The reviewer argues the tool definitely failed, definitely caused the improvement, or had an effect not isolated by this comparison.','had an effect not isolated by this comparison','The passage neither proves benefit nor proves absence of benefit.'),
 ('short-answer','What part of the pilot package would be reduced at scale?','individual adviser support','The proposed release would include less adviser time.'),
 ('truth','Every participant experienced the same performance change. TRUE, FALSE or NOT GIVEN?','NOT GIVEN','An average is given without individual outcomes.'),
 ('choice','Why collect discontinuation reasons: to identify barriers, to exclude all negative data, or to guarantee adoption?','to identify barriers','Reasons can distinguish practical access problems from lack of usefulness.'),
 ('rewrite','Preserve scope: The pilot supports further investigation but does not establish effectiveness at scale.','The pilot justifies additional evaluation, while wider effectiveness remains unproven.','Do not turn the uncertainty into a finding of failure.')],
 [('short-answer','What percentage continued using the tool?','75%','Thirty out of forty equals seventy-five percent.'),
 ('choice','Which claim is corrected first: continued use among volunteers, effectiveness for three quarters of farmers, or the number enrolled?','effectiveness for three quarters of farmers','The lead confuses the observed behaviour with effectiveness and expands the population.'),
 ('short-answer','What prior experience differed between the groups?','digital-tool experience','The analyst identifies an initial group difference.'),
 ('choice','The reviewer regards wider access as impossible, possible with evaluation, or already proven successful.','possible with evaluation','Expansion can be a learning phase rather than a certified outcome.'),
 ('short-answer','What support would replace most individual advice?','written guidance','The analyst describes the proposed larger programme.'),
 ('truth','The reviewer says a limitation automatically proves failure. TRUE or FALSE?','FALSE','The final sentence rejects that reversal.'),
 ('short-answer','What remains unknown about reduced support?','its effect / the effect of reduced support','The analyst states this uncertainty explicitly.'),
 ('rewrite','State the corrected opening claim.','Thirty of forty volunteer participants continued using the tool.','Keep the actual measure, sample and denominator; do not claim effectiveness for all farmers.')],
 'A pilot programme has promising results but several limitations. Should it be expanded? Develop a conditional recommendation and respond to the challenge: Are you being too cautious?',
 'Task 2-style practice: New technologies are often introduced widely after small trials. Some people think this encourages progress, while others believe stronger evidence should be required first. Discuss both views and give your opinion. Write at least 250 words.',
 """Small trials can reveal useful opportunities, but they rarely answer every question about a technology's wider use. I favour expansion when it is proportionate to the evidence and designed to address remaining uncertainties, rather than treated as an automatic endorsement of the technology.

Those who support rapid introduction have a reasonable concern: excessive demands for evidence can delay access to something beneficial. A limited trial cannot reproduce every possible setting, and some questions can only be answered once a technology is used more broadly. Wider access may therefore be part of the evaluation process, not merely a reward granted after evaluation is complete.

However, a promising pilot may depend on conditions that will not exist at scale. Volunteers can differ from typical users, and a small programme may provide unusually intensive support. Continued use also does not necessarily establish the intended benefit. If a trial measures convenience while the proposed policy promises improved performance, the evidence and the claim are misaligned.

The appropriate standard should consequently depend on the risks and reversibility of the decision. A low-risk tool that users can easily stop using may justify a broader experimental release. A system that makes consequential decisions about people requires stronger safeguards before deployment. In either case, the next phase should define meaningful outcomes, include relevant users and report limitations as well as favourable results.

In my view, progress and evaluation are not opposing goals. A well-designed expansion can provide access while generating more informative evidence. What should be resisted is the tendency to describe an early sign of promise as proof of universal effectiveness. Equally, recognising uncertainty is not a reason to assume that innovation has failed. It is a reason to make the next decision carefully and transparently.""",
 'This is a focused inference/argument pack, not a complete Reading section. The high-band target is preserving population, construct and certainty in paraphrase. The exact 75% calculation is checked; it is not an educational effectiveness estimate.')
add(11,'Resilience and efficiency: a defensible compromise',[
 ('resilience','noun','capacity to withstand or recover from disruption','The proposal sought greater resilience.'),
 ('efficiency','noun','using resources well in relation to an intended outcome','Efficiency was measured by ordinary operating cost.'),
 ('redundancy','noun','additional capacity or duplication beyond normal requirements','Some redundancy preserved an alternative route.'),
 ('optimisation','noun','choosing an arrangement that best meets a stated objective under constraints','Optimisation required an explicit objective.'),
 ('vulnerability','noun','exposure to possible harm or failure','A shared supplier created vulnerability.'),
 ('robustness','noun','the ability to remain useful or effective across varied conditions','The team tested the plan\'s robustness.')],
 ['strategic redundancy','supplier diversification','adaptive capacity'],
 """A fictional regional purchasing cooperative sought a supply arrangement that would be both economical and dependable. One proposal concentrated orders with the supplier offering the lowest ordinary price. A second spread orders across three suppliers, while a third combined a main contract with smaller reserve agreements. The cooperative initially asked its analysts to identify the optimal option.

The analysts replied that the question was incomplete. Optimality depended on the objective and the constraints. Minimising the cost of routine purchases was not the same as minimising the consequences of interruptions. Nor was maintaining every possible reserve a costless way to improve reliability. A meaningful comparison had to state which service failures were unacceptable and which additional costs members were willing to bear.

The first analysis treated the three suppliers in the diversified option as independent. This made the option appear well protected against disruption. A review of their operations revealed, however, that two used the same processing facility and all three relied on one major road for some deliveries. Different names on contracts did not necessarily mean independent sources of supply. The apparent diversification was partly superficial.

This finding did not make the concentrated option automatically preferable. Its dependence on a single supplier remained relevant. Instead, it changed the design question: which alternatives would actually remain available when a particular part of the system failed? The reserve agreements could be useful if they provided genuinely different routes or products, but less useful if they reproduced the same dependencies.

Members also disagreed about the appropriate definition of service continuity. Some prioritised the delivery of specific products, whereas others were willing to accept substitutes. A reserve policy could therefore appear successful or unsuccessful depending on whether an acceptable alternative counted as continuity. The cooperative needed an agreed operational definition before interpreting the comparison.

The final proposal did not maximise redundancy. It retained the main contract, added a limited reserve with a distinct route and specified when substitutes could be accepted. It also required periodic checks that the reserve remained practically available. A written agreement alone would not establish that goods, staff and transport could be mobilised when needed.

The committee described this as a defensible compromise rather than a final solution. It would review the arrangement if the main supplier's performance changed or if the reserve ceased to provide a genuinely different option. The proposal's value depended partly on that capacity for revision.

The case illustrates a wider principle of careful argument. A trade-off should be described precisely enough to guide a decision, not invoked as a vague excuse for any outcome. Efficiency and resilience can conflict on some measures while supporting each other on others. Better information about dependencies, for example, can prevent spending on reserves that offer little additional protection. The task is to identify which costs purchase which capabilities, for whom, and under what conditions. A slogan about either maximum efficiency or maximum resilience does not answer those questions.""",
 """Member A: Our report says diversification protects us because the three suppliers are independent.
Analyst: That assumption needs revision. Two share a processing facility, and all three use one road for some deliveries.
Member B: Then diversification is pointless, and we should take the cheapest single contract.
Analyst: That conclusion is too strong. The review shows that this particular diversification offers less protection than we assumed. It does not show that every alternative arrangement is pointless.
Chair: What should we ask instead?
Analyst: Which options would still be available if a specific dependency failed. The reserve should add a capability, not merely another supplier name.
Member A: What about accepting substitute products? That might let us maintain service without storing everything.
Member B: Only if members agree what counts as an acceptable substitute. Some kitchens need particular products for planned menus.
Chair: Then the service definition must be explicit. We should not call every substitution a success or every change a failure.
Analyst: Agreed. We also need to test whether the reserve can actually be activated. A contract is evidence of an agreement, not proof of operational readiness.
Member A: Would the main contract plus a smaller independent reserve be a reasonable compromise?
Analyst: It could be, under the conditions we have discussed. It would not remove every disruption risk, and it would have a cost.
Member B: I can support that if the review conditions are clear. We should not keep paying for a reserve that later becomes dependent on the same route.
Chair: Then include checks on the reserve's practical availability and independence. If those conditions change, the arrangement must be reassessed.
Analyst: Our conclusion should make the compromise visible: lower routine cost from the main contract, a limited alternative capability from the reserve, and explicit acceptance that some residual risk remains.
Chair: That is a decision people can scrutinise. Calling it optimal without stating those conditions would tell them much less.""",
 [('choice','Why was the request for the optimal option incomplete: no supplier existed, objectives and constraints were unspecified, or price was irrelevant?','objectives and constraints were unspecified','The second paragraph identifies the missing decision criteria.'),
 ('short-answer','Name ONE dependency shared by suppliers.','processing facility / major road','The review revealed both.'),
 ('truth','The review proved all diversification is pointless. TRUE, FALSE or NOT GIVEN?','FALSE','The passage explicitly rejects that generalisation.'),
 ('short-answer','What disagreement affected the definition of continuity?','whether substitutes were acceptable','Members differed over specific products versus alternatives.'),
 ('truth','The final proposal maximised redundancy regardless of cost. TRUE, FALSE or NOT GIVEN?','FALSE','It explicitly did not maximise redundancy.'),
 ('short-answer','What did the proposal add to the main contract?','a limited reserve with a distinct route','The alternative capability had to be genuinely different.'),
 ('choice','A written reserve agreement demonstrates operational readiness, an agreement only, or no useful information at all.','an agreement only','The passage requires practical availability checks before assuming readiness.'),
 ('rewrite','Express the conclusion without universalising it.','A main contract with a limited independent reserve was a defensible choice under the stated conditions.','Preserve the compromise, independence and conditional scope.')],
 [('choice','What does Member B initially infer too strongly: all diversification is pointless, dependencies exist, or price matters?','all diversification is pointless','The analyst narrows the implication of the review.'),
 ('short-answer','What should a reserve add beyond a name?','a capability / an available option','The analyst specifies functional value.'),
 ('choice','How should substitutions be judged: always success, always failure, or against an agreed definition?','against an agreed definition','The chair rejects both blanket classifications.'),
 ('truth','The analyst treats a contract as proof that the reserve can operate. TRUE or FALSE?','FALSE','The contract is only evidence of an agreement.'),
 ('short-answer','What two qualities of the reserve should be checked?','practical availability and independence','The chair names both checks.'),
 ('choice','Does the proposal remove every risk, retain residual risk, or avoid all costs?','retain residual risk','The analyst explicitly acknowledges remaining risk and cost.'),
 ('short-answer','What change would require reassessment?','loss of independence / changed reserve conditions','Dependence on the same route is the example.'),
 ('rewrite','Summarise the analyst\'s final position in one sentence.','Use the main contract for routine cost savings and a limited independent reserve for alternative capacity, while acknowledging cost and residual risk.','A complete summary includes benefits, conditions and limitations rather than a one-sided slogan.')],
 'Explain a situation in which two reasonable objectives conflict. Propose a compromise, state its conditions and respond to a challenge that your proposal is neither ambitious enough nor cheap enough.',
 'Task 2-style practice: Organisations should always choose the most efficient way of operating, even if this leaves little spare capacity. To what extent do you agree or disagree? Write at least 250 words.',
 """Efficiency is an important organisational objective, but the claim that it should always take priority assumes that efficiency has a single, uncontested meaning. I disagree with the statement because an arrangement that minimises routine costs may perform poorly when circumstances change. Nevertheless, this does not justify unlimited spending on spare capacity.

The strongest argument for a lean operation is that resources have alternative uses. Maintaining unused equipment, duplicate facilities or additional contracts can be expensive. Where a service can be interrupted without serious consequences, or where replacements are readily available, substantial reserves may be difficult to justify. It would be misleading to describe every unused resource as a necessary investment in resilience.

The opposite error is to treat all spare capacity as waste. An alternative supplier or reserve facility may preserve a service when the main arrangement fails. Its contribution is partly conditional, so everyday utilisation is an incomplete measure of value. The relevant comparison includes both the cost of maintaining the alternative and the consequences of not having it when needed.

However, a reserve is only useful if it provides a genuinely different capability. Several suppliers may depend on the same facility or route, leaving the organisation exposed to a shared failure. Effective planning therefore requires an understanding of dependencies, not simply a larger number of contracts. The organisation should also define which service outcomes matter and what degree of interruption is tolerable.

I would favour the least costly arrangement that meets defensible service requirements across relevant conditions, with periodic review as those conditions change. This approach may involve spare capacity, but not automatically the maximum possible amount. Efficiency and resilience should be evaluated together, rather than reduced to rival slogans. The objective is a transparent, revisable decision whose costs buy capabilities that the organisation can actually use.""",
 'The focus is expert-level argument control: relevant concession, conditional recommendation and avoidance of false dichotomy. The passage is not a source of universal management advice, and the essay is not assigned an official band.')
add(12,'Expert transfer: a decision with incomplete evidence',[
 ('contingency','noun','a possible future circumstance that requires a response','The decision included a contingency.'),
 ('resilience','noun','capacity to sustain or recover functioning under disruption','The review considered resilience.'),
 ('distribution','noun','how something is spread or allocated','The distribution of benefits was uneven.'),
 ('legitimacy','noun','the quality of being regarded as justified or acceptable','The process needed legitimacy.'),
 ('uncertainty','noun','a lack of complete confidence or knowledge','The estimate contained uncertainty.'),
 ('externality','count noun','an effect on others outside the direct transaction or decision','The proposal had a possible externality.')],
 ['defensible judgement','qualified conclusion','coherent synthesis'],
 """A fictional university was considering replacing several small food suppliers with one large contractor. The contractor offered a lower price and a single ordering system. The purchasing team expected the change to reduce administrative work, while the catering team hoped that more predictable deliveries would simplify planning. A draft recommendation described consolidation as the most efficient option.

The student committee did not reject the proposal, but asked what the word efficient included. The price comparison covered the contracted items and routine administration. It did not include the cost of changing menus, the consequences of a major interruption or the effects on smaller suppliers. These omissions did not make the quoted saving unreal, but they limited the claim that the proposal was superior overall.

A second report considered delivery performance. The large contractor had completed 96% of recorded deliveries within its stated time window during the previous year. The existing suppliers had a combined figure of 92%. The difference was four percentage points. However, the reports used different time windows: the contractor's window was wider. Without a common definition of on time, the percentages did not provide a straightforward ranking of punctuality.

The university also surveyed kitchen managers about the proposed ordering system. Most respondents expected it to be easier to use. This was relevant evidence about anticipated convenience, but the managers had seen a demonstration rather than used the system through a busy term. A favourable expectation should therefore not be reported as a measured reduction in administrative workload.

The contractor offered to run a trial in two kitchens. One was a small residential kitchen with a stable menu; the other served a larger, changing group. The proposal initially assigned the new system to whichever kitchen volunteered first. The evaluation team suggested that this would make interpretation difficult because the kitchens already differed substantially. It recommended collecting comparable baseline information and identifying which differences the evaluation could and could not address.

During consultation, smaller suppliers raised concerns about losing access to the university's business. Some committee members treated this as decisive evidence against consolidation. Others dismissed it as irrelevant because the university's primary duty was to its own service users. The chair argued that neither response was adequate. The effect on suppliers was a consideration to assess explicitly, but it did not by itself settle the procurement decision. The university needed to explain how it weighed cost, service continuity, flexibility and wider consequences.

The final recommendation was to proceed with a limited, reversible trial rather than commit immediately to a complete replacement. Its outcomes would include comparable delivery measures, actual staff time, menu flexibility and the ability to recover from an interruption. The team would also document which users and suppliers were affected. The trial would not be labelled successful simply because one indicator improved.

Crucially, the committee stated in advance what would justify expansion and what would trigger revision. A reduction in routine costs would be valuable, but not if it came with unacceptable disruption to essential meals. Conversely, a small implementation problem would not automatically invalidate the entire approach if it could be corrected without undermining the intended benefit.

The resulting recommendation was less dramatic than either an unconditional endorsement or a rejection. It was also more informative. It distinguished observed performance from forecasts, comparable measures from superficially similar numbers, and empirical findings from judgements about acceptable trade-offs. The university could act without claiming that uncertainty had disappeared. It could make its reasoning inspectable and identify the evidence needed for a stronger commitment. That combination of clarity, qualification and practical relevance—not the mere appearance of confidence—was the standard the committee ultimately chose.""",
 """Chair: We need a final recommendation. The draft says the contractor is more efficient because its price is lower and its on-time figure is ninety-six percent.
Analyst: I would separate those claims. The quoted routine price is lower. The delivery comparison is less straightforward because the contractor and existing suppliers use different time windows.
Catering manager: The existing figure is ninety-two percent, so the difference is four percent, isn't it?
Analyst: Four percentage points. But even that numerical difference should not be interpreted as a fair punctuality comparison until the definition is the same.
Student representative: What about the ordering system? Most managers said it would be easier.
Analyst: They expected it to be easier after a demonstration. That is not yet evidence of the staff time it saves during normal use.
Purchasing officer: We cannot measure everything before we try it. Waiting indefinitely would also have a cost.
Student representative: I agree. My concern is not that we should wait for certainty. It is that the recommendation should distinguish what we know from what we expect.
Chair: Would a reversible trial address that?
Catering manager: Potentially, provided that we choose the outcomes carefully. Delivery timing matters, but so do menu flexibility and continuity when something goes wrong.
Purchasing officer: Could we use whichever kitchen volunteers first?
Analyst: We should be cautious. The kitchens differ in size, menu stability and users. Volunteering could add another difference. We need baseline information and an explicit account of the comparison's limits.
Student representative: We also need to explain how the effect on smaller suppliers is considered. Ignoring it would not make it disappear.
Purchasing officer: Agreed, although it should not automatically override every service benefit either.
Chair: Then the recommendation is a bounded trial with common delivery definitions, measured staff time, continuity and flexibility outcomes, and a record of wider effects.
Analyst: We should set expansion and review conditions before seeing the results. Otherwise, we may redefine success around whichever measure happens to improve.
Catering manager: A small correctable implementation problem should not count as complete failure. But a lower price should not excuse unacceptable interruption of essential meals.
Student representative: That sounds like a position we can defend. It allows action without pretending the evidence is stronger than it is.
Chair: Good. The conclusion should be clear enough to guide a decision and qualified enough to remain faithful to the evidence.""",
 [('choice','What does the lower quoted price establish: lower routine contracted cost, superiority on every objective, or guaranteed resilience?','lower routine contracted cost','The passage recognises the saving while limiting the broader inference.'),
 ('short-answer','What is the numerical difference between 96% and 92%, expressed in percentage points?','4 percentage points','The subtraction gives four points, not an automatically comparable performance advantage.'),
 ('truth','The delivery percentages used the same definition of on time. TRUE, FALSE or NOT GIVEN?','FALSE','The contractor used a wider time window.'),
 ('choice','The manager survey measured actual workload reduction, anticipated convenience, or supplier income.','anticipated convenience','Respondents had seen a demonstration rather than used the system for a term.'),
 ('short-answer','Why might choosing the first volunteering kitchen complicate interpretation?','existing differences and self-selection could affect the comparison','The kitchens differ before the intervention, and volunteering may add selection differences.'),
 ('truth','The passage provides the exact financial loss for every smaller supplier. TRUE, FALSE or NOT GIVEN?','NOT GIVEN','Potential effects are discussed without those figures.'),
 ('choice','The final recommendation is immediate replacement, no further action, or a reversible trial with explicit conditions.','a reversible trial with explicit conditions','The final plan preserves action, evaluation and revision.'),
 ('rewrite','Summarise the central argument in at most 35 words.','The university should test the proposal under comparable measures and explicit decision criteria, distinguishing observed evidence from expectations and acknowledging trade-offs before making a larger commitment.','The summary must include evidence quality, conditional action and trade-offs rather than only lower prices.')],
 [('short-answer','What numerical expression corrects the catering manager\'s comparison?','four percentage points','The analyst distinguishes points from percent change.'),
 ('choice','What must be aligned before interpreting punctuality: definitions, supplier names, or survey wording alone?','definitions','Both time windows must describe a comparable outcome.'),
 ('short-answer','What did managers actually observe before the survey?','a demonstration','They had not yet measured term-long use.'),
 ('choice','Does the student representative demand certainty, reject any trial, or ask for evidence and expectations to be distinguished?','ask for evidence and expectations to be distinguished','The representative explicitly rejects waiting for certainty.'),
 ('short-answer','Name TWO trial outcomes other than routine price.','staff time; delivery performance; continuity; menu flexibility','Any two correctly identified distinct outcomes are acceptable.'),
 ('truth','The purchasing officer says the effect on small suppliers should automatically override every other consideration. TRUE or FALSE?','FALSE','The officer accepts consideration but rejects automatic priority.'),
 ('short-answer','When should expansion and review conditions be set?','before seeing the results','This avoids selecting a success definition after observing outcomes.'),
 ('rewrite','State the chair\'s final standard in your own words.','Make a clear, usable recommendation without claiming more than the evidence supports.','The answer must preserve both practical clarity and faithful qualification.')],
 'Complete a simulated Part 3 exchange. Main question: How should institutions make decisions when the evidence is incomplete? Follow-ups: Can too much caution be harmful? Who should decide acceptable trade-offs? What would make you change your recommendation? Answer spontaneously; do not deliver a prepared essay.',
 'Task 2-style practice: Institutions should prioritise lower costs when choosing services, even when this reduces flexibility or affects other organisations. To what extent do you agree or disagree? Write at least 250 words. Address the extent of agreement explicitly and avoid invented evidence.',
 """Lower costs deserve serious consideration when institutions select services, but they should not be treated as an overriding objective regardless of the consequences. I disagree with the statement because a saving on the contract price may conceal losses in service quality, adaptability or wider responsibilities. This does not mean that every affected organisation should be protected from competition.

The argument for prioritising cost is strongest when the alternatives provide genuinely comparable services. Money saved can support other institutional purposes, and a simpler arrangement may reduce unnecessary administration. Refusing a better-value offer merely to preserve existing relationships could impose an unjustified burden on the people the institution serves.

However, comparability cannot be assumed. A cheaper service may be less able to respond when demand changes or an interruption occurs. These limitations might be unimportant in some settings but serious where continuity is essential. An institution should therefore examine what the quoted price includes and what additional responsibilities it may have to absorb. Flexibility is not automatically worth any price, but neither is it worthless because its benefits are difficult to express in a single routine cost figure.

Effects on other organisations also require explicit judgement. The possibility that a supplier will lose business does not, by itself, establish that a contract should be rejected. Nevertheless, relevant consequences should be acknowledged rather than excluded from the analysis simply because they occur outside the purchasing department. A transparent decision explains how those effects are weighed against the expected benefits.

I would consequently favour the least costly option that meets clearly justified service requirements and an acceptable balance of wider consequences. Where important uncertainties remain, a limited trial may be preferable to an irreversible commitment. Cost discipline is compatible with responsible decision-making, but only when lower expenditure is treated as one consideration within a defensible evaluation, not as proof that every other concern has been resolved.""",
 'This is an authored high-level transfer pack, not a sealed Band 9 exam or a certified answer. It deliberately distinguishes evaluation criteria from arbitrary confidence. A readiness decision still requires unfamiliar texts, natural recordings, full section timing and calibrated analytic scoring.')

if __name__ == '__main__':
    assert len(EX)==12
    out=ROOT/'examples'/'reference_materials.json'
    out.write_text(json.dumps(EX,ensure_ascii=False,indent=2),encoding='utf-8')
    for e in EX:
        p=ROOT/'examples'/f"{e['id']}.md"
        rows=[f"# {e['id']} — {e['title']}",e['provenance'],f"Associated design lesson: **{e['lesson_id']}**. Status: **authored reference pack, not a complete runtime lesson**.",
              '## Target lexicon','| Target | Role | Meaning | Original example |','|---|---|---|---|']
        rows += ['| '+' | '.join(x)+' |' for x in e['lexicon']]
        rows += ['','**Word partners:** '+ '; '.join(e['collocations']), '\n## Reading stimulus', e['reading']['text'], '\n## Listening script — audio not yet recorded',e['listening']['script']]
        for label,key in [('Reading','reading_questions'),('Listening','listening_questions')]:
            rows += [f'\n## {label} questions and answer rationales']
            for q in e[key]:rows += [f"### {q['id']} · `{q['type']}`",q['prompt'],f"**Answer:** {q['answer']}\n\n**Why:** {q['rationale']}"]
        rows += ['\n## Speaking',e['speaking']['prompt'],'\n## Writing',e['writing']['prompt'],'\n### Original model — show after submission',e['writing']['model'],'\n## Design and assessment note',e['teacher_note'], '\n**Evidence for the operations, not certification of this pack:** '+', '.join(e['source_ids'])+'. See the source ledger in README.md.']
        p.write_text('\n\n'.join(rows)+'\n',encoding='utf-8')
    print('Authored',len(EX),'packs;',sum(len(e['reading_questions'])+len(e['listening_questions']) for e in EX),'keyed comprehension items')
    print('Task 2 model word counts:',[(e['stage'],len(e['writing']['model'].split())) for e in EX if e['stage']>=7])
