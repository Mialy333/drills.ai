import os
import sys
import json
from src.ai_generator.agent import DrillGeneratorAgent

def main():
    # 1. Verification de la clé API
    if not os.getenv("OPENAI_API_KEY"):
        print("🚨 Error: OPENAI_API_KEY is not set in your .env file.")
        print("Please wait for your Hackathon credits or insert a valid token.")
        sys.exit(1)

    print("🚀 Initializing DRILLS.ai Generator Agent...")
    agent = DrillGeneratorAgent()

    # 2. Simulation d'une offre d'emploi cible (À remplacer par un vrai copier-coller plus tard)
    # Exemple : Un poste d'ingénieur IA chez Google Cloud Paris
    sample_job_description = """
    We are looking for an AI Software Engineer specialist in Python and microservices. 
    The candidate must master API development (FastAPI), data integration validation, 
    and robust error handling when orchestrating Large Language Models. 
    Knowledge of strict schema validation (Pydantic) and asynchronous safety is a plus.
    """

    print("🧠 Parsing job description and synthesizing custom technical drill via OpenAI...")
    try:
        # Appel de l'agent OpenAI configuré avec Structured Outputs
        generated_drill = agent.generate_drill_from_job(sample_job_description)
        
        # 3. Définition du chemin d'écriture cible dans ton architecture existante
        target_filename = f"{generated_drill.drill_id.lower()}.json"
        # On cible ton dossier de drills existants pour injecter le nouveau niveau
        target_path = os.path.join("src", "drills", "python", "qa", target_filename)

        print(f"💾 Validation successful! Writing type-safe JSON to: {target_path}")
        
        # Sécurisation : s'assurer que le dossier parent existe
        os.makedirs(os.path.dirname(target_path), exist_ok=True)

        # Écriture propre du JSON formaté
        with open(target_path, "w", encoding="utf-8") as f:
            # .model_dump() de Pydantic v2 convertit l'objet en dictionnaire Python pur
            json.dump(generated_drill.model_dump(), f, indent=2, ensure_ascii=False)

        print(f"✨ Success! '{generated_drill.title}' ({generated_drill.drill_id}) injected smoothly into your game catalog.")

    except Exception as e:
        print(f"❌ Automation failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
