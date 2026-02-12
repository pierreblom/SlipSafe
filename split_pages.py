import re
import os

def create_page(page_name, section_id, output_dir_name):
    # Ensure directory exists
    output_dir = os.path.join(os.getcwd(), output_dir_name)
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    output_filename = os.path.join(output_dir, 'index.html')
    
    with open('index.html', 'r') as f:
        lines = f.readlines()

    new_lines = []
    
    # We want to identify sections to keep vs remove
    target_sections = ['screen-home', 'screen-ai', 'screen-insights', 'screen-business', 'screen-profile']
    
    # State tracking
    skipping_section = False
    
    for line in lines:
        original_line = line
        
        # Check for section start
        # Regex to capture id
        match = re.search(r'<section\s+id="(screen-[a-z]+)"', line)
        if match:
            s_id = match.group(1)
            
            if s_id in target_sections:
                if s_id == section_id:
                    # This is OUR section. KEEP IT.
                    skipping_section = False
                    # Make sure it's active and clean up classes
                    # Remove 'hidden' if present, add 'active' if missing
                    if 'hidden' in line:
                        line = line.replace('hidden', '')
                    if 'active' not in line:
                         line = line.replace('class="screen', 'class="screen active')
                else:
                    # This is ANOTHER section. SKIP IT.
                    skipping_section = True
            else:
                # Unknown section (maybe modal?). Keep it.
                skipping_section = False
        
        if skipping_section:
            # Check if this line ENDS the section
            if '</section>' in line:
                skipping_section = False
            # Don't append this line
            continue

        # Modify paths for assets (since we are moving down one level)
        # Fix CSS/JS/Images
        # Use absolute paths from root
        line = line.replace('src="front_end/', 'src="/front_end/')
        line = line.replace('href="front_end/', 'href="/front_end/')
        line = line.replace('src="logo.png"', 'src="/logo.png"')
        line = line.replace('<script src="https://cdn.tailwindcss.com"></script>', '<link rel="stylesheet" href="/front_end/tailwind.css">')
        # Fix nav links
        line = line.replace('href="#home"', 'href="/home"')
        line = line.replace('href="#ai"', 'href="/ai"')
        line = line.replace('href="#insights"', 'href="/insights"')
        line = line.replace('href="#business"', 'href="/business"')
        line = line.replace('href="#profile"', 'href="/profile"')
        
        # Fix sidebar active state
        # First, reset any active state to inactive
        if 'sidebar-item' in line:
            # If line has this page's nav ID, make it active
            if f'id="nav-{page_name}"' in line:
                line = line.replace('nav-inactive', 'nav-active')
            else:
                # Ensure it is inactive
                line = line.replace('nav-active', 'nav-inactive')

        new_lines.append(line)

    with open(output_filename, 'w') as f:
        f.writelines(new_lines)
    print(f"Created {output_filename}")

# Run for each page
create_page('home', 'screen-home', 'home')
create_page('ai', 'screen-ai', 'ai')
create_page('insights', 'screen-insights', 'insights')
create_page('business', 'screen-business', 'business')
create_page('profile', 'screen-profile', 'profile')
